/**
 * picozip.h v1.0.0 - A simple library to write uncompressed ZIP files.
 *
 * This is just some code I wrote to create really simple ZIP files
 * with no compression and the extended timestamp attribute,
 * which I consider a bare minimum for a ZIP file.
 * The code is reasonably portable, and I plan to keep compatibility with C99.
 * Currently the code is compatible with C89, but no guarantees there.
 * This library is licensed under the MIT license, which is available in
 * the LICENSE file or the comment at the end of this file.
 *
 * TL;DR
 *
 * - include picozip.h and define PICOZIP_IMPLEMENTATION.
 * - call picozip_new and friends to get a picozip_file.
 * - call picozip_new_entry_mem and friends to add files or directories.
 * - call picozip_end and friends to finalize the file and write all the necessary headers.
 * - call picozip_free and friends to free any memory associated with the ZIP file.
 *
 * picozip is a header-only library, so the steps to use it is quite straightforward.
 * Simply include the file and define PICOZIP_IMPLEMENTATION in one of the files
 * that include the library. If you have multiple places that uses picozip.h,
 * you should only define PICOZIP_IMPLEMENTATION once.
 *
 * Optionally, you may wish to define PICOZIP_NO_STDIO to disable file IO
 * capabilities, or PICOZIP_NO_OS_MTIME to disable support for getting file
 * modification times via stat() and equivalent functions. You can also redefine
 * PICOZIP_READ_BUF to use a larger / smaller buffer when reading files
 * (only relevant when using picozip_new_entry_path and picozip_new_entry_file).
 *
 * picozip uses callbacks to write data to the destination. When calling picozip_new,
 * you need to pass a callback to allocate and free any memory used by the library,
 * as well as a callback to write the ZIP file data to your desired output.
 * The convenience functions picozip_new_mem, picozip_new_file and picozip_new_path wraps
 * this by providing some built-in functions that uses malloc(), free(), fopen(), etc.
 * The callbacks are defined as such:
 *
 * typedef void *(*picozip_alloc_callback)(void *userdata, size_t size);
 * typedef void (*picozip_free_callback)(void *userdata, void *mem);
 * typedef size_t (*picozip_write_callback)(void *userdata, const void *mem, size_t size);
 *
 * Each function takes a userdata pointer which is defined when calling picozip_new().
 * picozip_alloc_callback should allocate a piece of memory of <size> size.
 * It does not have to be zeroed. picozip_free_callback should free the memory allocated
 * by picozip_alloc_callback.
 * picozip_write_callback should read <size> number of bytes from <mem> and write it to the output.
 * It should return the number of bytes written.
 *
 *
 * Each picozip function returns an int, where 0 indicates success. picozip generally uses constants
 * defined by errno.h, and only explicitly defines PICOZIP_EINVAL, PICOZIP_ENOMEM and PICOZIP_EIO.
 * picozip functions does not set errno (except when errno is set by an underlying libc function).
 *
 * To create a ZIP file, you can call picozip_new, picozip_new_mem, picozip_new_file or picozip_new_path.
 * picozip_new requires you to pass in all the callbacks to allocate, free and write data.
 * picozip_new_mem, picozip_new_file and picozip_new_path allows you to create a zip file in-memory, a file pointer or a path.
 * picozip_new and equivalent returns a pointer to a picozip_file struct which can be used by other functions.
 * Calls with the same picozip_file pointer are thread safe.
 *
 * To free the picozip_file pointer, use picozip_free, picozip_free_mem or picozip_free_path.
 * picozip_file pointers created by calling picozip_new_mem or picozip_new_path must be freed
 * by calling picozip_free_mem and picozip_free_path respectively to free their underlying resources.
 * When using picozip_new_file, the file pointer will not be closed automatically.
 *
 * You can now call picozip_new_entry_mem, picozip_new_entry_mem_ex, picozip_new_entry_file
 * or picozip_new_entry_path to create files and directories in the ZIP files.
 * To create directories, you can call picozip_new_entry_mem with <size> of 0, <mem> set to NULL
 * and append a forward slash (/) in the path.
 * When PICOZIP_NO_OS_MTIME is not defined, picozip will try to get a file's modification time
 * via stat() and equivalent when using picozip_new_entry_file and picozip_new_entry_path.
 *
 * After adding all the files and directories, you can finalize the ZIP file by calling
 * picozip_end or picozip_end_ex. This will write all the global headers. Note that you
 * must call picozip_free and equivalent after calling picozip_end to free all the resources
 * associated with the picozip_file. Calling picozip_free will not finalize the archive,
 * and will produce a corrupted file.
 */

#ifndef PICOZIP_H
#define PICOZIP_H

#if defined(__cplusplus)
extern "C"
{
#endif

#ifndef PICOZIP_NO_OS_MTIME
#if defined(_WIN32)
#define PICOZIP__WIN
#include <sys/stat.h>

    typedef struct _stat picozip__stat;
#define picozip__fileno _fileno
#define picozip__fstat _fstat

#elif defined(__unix__) || (defined(__APPLE__) && defined(__MACH__))
#define _XOPEN_SOURCE 600
#define _POSIX_C_SOURCE 200112L
#define PICOZIP__UNIX
#include <sys/stat.h>

    typedef struct stat picozip__stat;
#define picozip__fileno fileno
#define picozip__fstat fstat

#endif
#endif

#include <stdlib.h>
#include <stdint.h>
#include <string.h>
#include <errno.h>
#include <time.h>

#ifndef PICOZIP_NO_STDIO
#include <stdio.h>
#endif

/** Buffer size used to read files. */
#define PICOZIP_READ_BUF 2048

/** Error types. */
#define PICOZIP_OK 0
#define PICOZIP_EINVAL EINVAL
#define PICOZIP_ENOMEM ENOMEM
#define PICOZIP_EIO EIO

    /** Callbacks to allocate, free and write data. */
    typedef void *(*picozip_alloc_callback)(void *userdata, size_t size);
    typedef void (*picozip_free_callback)(void *userdata, void *mem);
    typedef size_t (*picozip_write_callback)(void *userdata, const void *mem, size_t size);

    /** Stores data for a ZIP file. */
    typedef struct picozip__file picozip_file;

    /** Library functions */
    extern int picozip_new(picozip_file **ofile,
                           picozip_write_callback write_cb,
                           picozip_alloc_callback alloc_cb,
                           picozip_free_callback free_cb,
                           void *userdata);
    extern int picozip_new_entry_mem(picozip_file *file, const char *const path,
                                     const uint8_t *data, size_t size);
    extern int picozip_new_entry_mem_ex(picozip_file *file, const char *const path,
                                        const uint8_t *data, size_t size, time_t mod_time,
                                        const char *const comment, size_t comment_len);
    extern int picozip_end(picozip_file *file);
    extern int picozip_end_ex(picozip_file *file, const char *const comment, size_t comment_len);
    extern int picozip_free(picozip_file *file);

    /** Convenience functions */
    extern int picozip_new_mem(picozip_file **ofile);
    extern size_t picozip_get_mem(picozip_file *file, void **mem);
    extern int picozip_free_mem(picozip_file *file);

/** File IO functions */
#ifndef PICOZIP_NO_STDIO
    extern int picozip_new_file(picozip_file **ofile, FILE *fptr);
    extern int picozip_new_path(picozip_file **ofile, const char *const path, const char *const mode);
    extern int picozip_new_entry_path(picozip_file *file, const char *const path, const char *const file_path,
                                      const char *const comment, size_t comment_len);
    extern int picozip_new_entry_file(picozip_file *file, const char *const path, FILE *fptr,
                                      const char *const comment, size_t comment_len);
    extern int picozip_free_path(picozip_file *file);
#endif

#ifdef PICOZIP_IMPLEMENTATION

/* magic */
#define PICOZIP__LOCAL_MAGIC 0x04034b50
#define PICOZIP__CENTRAL_MAGIC 0x02014b50
#define PICOZIP__EOCD_MAGIC 0x06054b50
#define PICOZIP__MIN_VERSION 0x14
#define PICOZIP__TIMESTAMP_MAGIC 0x5455
#define PICOZIP__DATADESC_MAGIC 0x08074b50
#define PICOZIP__FLAG_DATADESC (1 << 3)

/* header sizes */
#define PICOZIP__LOCAL_HEADER_SIZE 30
#define PICOZIP__CD_HEADER_SIZE 46
#define PICOZIP__EOCD_SIZE 22
#define PICOZIP__ATTR_SIZE 4
#define PICOZIP__LOCAL_TIMESTAMP_SIZE 5
#define PICOZIP__CD_TIMESTAMP_SIZE 5
#define PICOZIP__DATADESC_SIZE 16

/* big enough for all zip headers */
#define PICOZIP__SCRATCH_BUFFER_SIZE 64

/* write data to bytes */
#define PICOZIP__WRITE_LE16(A, O, V)      \
    do                                    \
    {                                     \
        A[(O) + 0] = (uint8_t)((V) >> 0); \
        A[(O) + 1] = (uint8_t)((V) >> 8); \
    } while (0)

#define PICOZIP__WRITE_LE32(A, O, V)       \
    do                                     \
    {                                      \
        A[(O) + 0] = (uint8_t)((V) >> 0);  \
        A[(O) + 1] = (uint8_t)((V) >> 8);  \
        A[(O) + 2] = (uint8_t)((V) >> 16); \
        A[(O) + 3] = (uint8_t)((V) >> 24); \
    } while (0)

    /* utilities to convert UNIX time to DOS time */
    static void picozip__time_to_dostime(time_t current_time, uint16_t *dos_date, uint16_t *dos_time)
    {
        struct tm *tm = localtime(&current_time);
        if (tm->tm_year < 80)
        {
            /* clamp the timestamp to 1980-1-1 00:00:00 to avoid any underflow */
            tm->tm_year = 80;
            tm->tm_sec = tm->tm_min = tm->tm_hour = tm->tm_mon = 0;
            tm->tm_mday = 1;
        }
        *dos_time = (uint16_t)(((tm->tm_hour << 11) & 0xf800) | ((tm->tm_min << 5) & 0x7e0) | ((tm->tm_sec >> 1) & 0x1f));
        *dos_date = (uint16_t)((((tm->tm_year + 1900 - 1980) << 9) & 0xfe00) | (((tm->tm_mon + 1) << 5) & 0x1e0) | (tm->tm_mday & 0x1f));
    }

/* https://create.stephan-brumme.com/crc32 */
#define PICOZIP__CRC_START 0

    static uint32_t picozip__crc32(const uint8_t *ptr, size_t buf_len, uint32_t crc)
    {
        static const uint32_t s_crc_table[256] = {
            0x00000000, 0x77073096, 0xEE0E612C, 0x990951BA, 0x076DC419, 0x706AF48F, 0xE963A535,
            0x9E6495A3, 0x0EDB8832, 0x79DCB8A4, 0xE0D5E91E, 0x97D2D988, 0x09B64C2B, 0x7EB17CBD,
            0xE7B82D07, 0x90BF1D91, 0x1DB71064, 0x6AB020F2, 0xF3B97148, 0x84BE41DE, 0x1ADAD47D,
            0x6DDDE4EB, 0xF4D4B551, 0x83D385C7, 0x136C9856, 0x646BA8C0, 0xFD62F97A, 0x8A65C9EC,
            0x14015C4F, 0x63066CD9, 0xFA0F3D63, 0x8D080DF5, 0x3B6E20C8, 0x4C69105E, 0xD56041E4,
            0xA2677172, 0x3C03E4D1, 0x4B04D447, 0xD20D85FD, 0xA50AB56B, 0x35B5A8FA, 0x42B2986C,
            0xDBBBC9D6, 0xACBCF940, 0x32D86CE3, 0x45DF5C75, 0xDCD60DCF, 0xABD13D59, 0x26D930AC,
            0x51DE003A, 0xC8D75180, 0xBFD06116, 0x21B4F4B5, 0x56B3C423, 0xCFBA9599, 0xB8BDA50F,
            0x2802B89E, 0x5F058808, 0xC60CD9B2, 0xB10BE924, 0x2F6F7C87, 0x58684C11, 0xC1611DAB,
            0xB6662D3D, 0x76DC4190, 0x01DB7106, 0x98D220BC, 0xEFD5102A, 0x71B18589, 0x06B6B51F,
            0x9FBFE4A5, 0xE8B8D433, 0x7807C9A2, 0x0F00F934, 0x9609A88E, 0xE10E9818, 0x7F6A0DBB,
            0x086D3D2D, 0x91646C97, 0xE6635C01, 0x6B6B51F4, 0x1C6C6162, 0x856530D8, 0xF262004E,
            0x6C0695ED, 0x1B01A57B, 0x8208F4C1, 0xF50FC457, 0x65B0D9C6, 0x12B7E950, 0x8BBEB8EA,
            0xFCB9887C, 0x62DD1DDF, 0x15DA2D49, 0x8CD37CF3, 0xFBD44C65, 0x4DB26158, 0x3AB551CE,
            0xA3BC0074, 0xD4BB30E2, 0x4ADFA541, 0x3DD895D7, 0xA4D1C46D, 0xD3D6F4FB, 0x4369E96A,
            0x346ED9FC, 0xAD678846, 0xDA60B8D0, 0x44042D73, 0x33031DE5, 0xAA0A4C5F, 0xDD0D7CC9,
            0x5005713C, 0x270241AA, 0xBE0B1010, 0xC90C2086, 0x5768B525, 0x206F85B3, 0xB966D409,
            0xCE61E49F, 0x5EDEF90E, 0x29D9C998, 0xB0D09822, 0xC7D7A8B4, 0x59B33D17, 0x2EB40D81,
            0xB7BD5C3B, 0xC0BA6CAD, 0xEDB88320, 0x9ABFB3B6, 0x03B6E20C, 0x74B1D29A, 0xEAD54739,
            0x9DD277AF, 0x04DB2615, 0x73DC1683, 0xE3630B12, 0x94643B84, 0x0D6D6A3E, 0x7A6A5AA8,
            0xE40ECF0B, 0x9309FF9D, 0x0A00AE27, 0x7D079EB1, 0xF00F9344, 0x8708A3D2, 0x1E01F268,
            0x6906C2FE, 0xF762575D, 0x806567CB, 0x196C3671, 0x6E6B06E7, 0xFED41B76, 0x89D32BE0,
            0x10DA7A5A, 0x67DD4ACC, 0xF9B9DF6F, 0x8EBEEFF9, 0x17B7BE43, 0x60B08ED5, 0xD6D6A3E8,
            0xA1D1937E, 0x38D8C2C4, 0x4FDFF252, 0xD1BB67F1, 0xA6BC5767, 0x3FB506DD, 0x48B2364B,
            0xD80D2BDA, 0xAF0A1B4C, 0x36034AF6, 0x41047A60, 0xDF60EFC3, 0xA867DF55, 0x316E8EEF,
            0x4669BE79, 0xCB61B38C, 0xBC66831A, 0x256FD2A0, 0x5268E236, 0xCC0C7795, 0xBB0B4703,
            0x220216B9, 0x5505262F, 0xC5BA3BBE, 0xB2BD0B28, 0x2BB45A92, 0x5CB36A04, 0xC2D7FFA7,
            0xB5D0CF31, 0x2CD99E8B, 0x5BDEAE1D, 0x9B64C2B0, 0xEC63F226, 0x756AA39C, 0x026D930A,
            0x9C0906A9, 0xEB0E363F, 0x72076785, 0x05005713, 0x95BF4A82, 0xE2B87A14, 0x7BB12BAE,
            0x0CB61B38, 0x92D28E9B, 0xE5D5BE0D, 0x7CDCEFB7, 0x0BDBDF21, 0x86D3D2D4, 0xF1D4E242,
            0x68DDB3F8, 0x1FDA836E, 0x81BE16CD, 0xF6B9265B, 0x6FB077E1, 0x18B74777, 0x88085AE6,
            0xFF0F6A70, 0x66063BCA, 0x11010B5C, 0x8F659EFF, 0xF862AE69, 0x616BFFD3, 0x166CCF45,
            0xA00AE278, 0xD70DD2EE, 0x4E048354, 0x3903B3C2, 0xA7672661, 0xD06016F7, 0x4969474D,
            0x3E6E77DB, 0xAED16A4A, 0xD9D65ADC, 0x40DF0B66, 0x37D83BF0, 0xA9BCAE53, 0xDEBB9EC5,
            0x47B2CF7F, 0x30B5FFE9, 0xBDBDF21C, 0xCABAC28A, 0x53B39330, 0x24B4A3A6, 0xBAD03605,
            0xCDD70693, 0x54DE5729, 0x23D967BF, 0xB3667A2E, 0xC4614AB8, 0x5D681B02, 0x2A6F2B94,
            0xB40BBE37, 0xC30C8EA1, 0x5A05DF1B, 0x2D02EF8D};

        uint32_t crc32 = (uint32_t)crc ^ 0xFFFFFFFF;

        while (buf_len >= 4)
        {
            crc32 = (crc32 >> 8) ^ s_crc_table[(crc32 ^ ptr[0]) & 0xFF];
            crc32 = (crc32 >> 8) ^ s_crc_table[(crc32 ^ ptr[1]) & 0xFF];
            crc32 = (crc32 >> 8) ^ s_crc_table[(crc32 ^ ptr[2]) & 0xFF];
            crc32 = (crc32 >> 8) ^ s_crc_table[(crc32 ^ ptr[3]) & 0xFF];
            ptr += 4;
            buf_len -= 4;
        }

        while (buf_len)
        {
            crc32 = (crc32 >> 8) ^ s_crc_table[(crc32 ^ ptr[0]) & 0xFF];
            ++ptr;
            --buf_len;
        }

        return ~crc32;
    }

    /** A dynamic array. */
    typedef struct picozip__vec
    {
        void *data;
        size_t cap, size;
    } picozip__vec;

    /** File entry. */
    typedef struct picozip__entry
    {
        uint16_t version_made, version_extract, flags, comp_method;
        time_t mod_time;
        uint32_t crc32, comp_size, uncomp_size;
        uint16_t filename_len, extra_field_len, comment_len, internal_attr;
        uint32_t external_attr, header_offset;
        uint8_t metadata[1];
    } picozip__entry;

    /** The zip file. */
    struct picozip__file
    {
        picozip_alloc_callback alloc_cb;
        picozip_write_callback write_cb;
        picozip_free_callback free_cb;
        size_t offset, num_entries;
        picozip__vec entries;
        void *userdata;
        uint8_t scratch[PICOZIP__SCRATCH_BUFFER_SIZE];
    };

    typedef struct picozip__mem_file
    {
        picozip_file *file;
        picozip__vec mem;
    } picozip__mem_file;

    static void *picozip__vec_alloc(picozip__vec *vec, size_t size, picozip_alloc_callback alloc, picozip_free_callback free, void *userdata)
    {
        size_t new_cap;
        void *new_data;

        if (vec->size + size > vec->cap)
        {
            new_cap = vec->size + size;
            new_data = alloc(userdata, new_cap);
            if (!new_data)
                return NULL;
            memcpy(new_data, vec->data, vec->size);
            free(userdata, vec->data);
            vec->data = new_data;
            vec->cap = new_cap;
        }
        return vec->data;
    }

    int picozip_new(picozip_file **ofile, picozip_write_callback write_cb, picozip_alloc_callback alloc_cb, picozip_free_callback free_cb, void *userdata)
    {
        picozip_file *file;

        if (!ofile || !write_cb || !alloc_cb || !free_cb)
            return PICOZIP_EINVAL;

        if (!(file = (picozip_file *)alloc_cb(userdata, sizeof(picozip_file))))
            return PICOZIP_ENOMEM;

        memset(file, 0, sizeof(picozip_file));
        file->alloc_cb = alloc_cb;
        file->write_cb = write_cb;
        file->free_cb = free_cb;
        file->userdata = userdata;
        *ofile = file;

        return PICOZIP_OK;
    }

    static picozip__entry *picozip__alloc_entry(picozip_file *file, size_t metadata_len)
    {
        picozip__entry *entry, **entries;

        if (!(entries = (picozip__entry **)picozip__vec_alloc(&file->entries, sizeof(picozip__entry *), file->alloc_cb, file->free_cb, file->userdata)))
            return NULL;

        entry = (picozip__entry *)file->alloc_cb(file->userdata, sizeof(picozip__entry) + metadata_len);
        if (!entry)
            return NULL;

        entries[file->num_entries++] = entry;
        file->entries.size += sizeof(picozip__entry *);

        return entry;
    }

    static void picozip__free_last_entry(picozip_file *file)
    {
        if (file->num_entries)
        {
            file->free_cb(file->userdata, ((picozip__entry **)file->entries.data)[--file->num_entries]);
            file->entries.size -= sizeof(picozip__entry *);
        }
    }

#define PICOZIP__FLUSH(FILE, SRC, SIZE, IFFAIL)                                          \
    do                                                                                   \
    {                                                                                    \
        if ((FILE)->write_cb((FILE)->userdata, (SRC), (size_t)(SIZE)) != (size_t)(SIZE)) \
            IFFAIL(FILE)->offset += (size_t)(SIZE);                                      \
    } while (0)

    static int picozip__write_local_entry(picozip_file *file, picozip__entry *entry)
    {
        uint16_t dos_date, dos_time;
        /* write the entry to the output */
        PICOZIP__WRITE_LE32(file->scratch, 0, PICOZIP__LOCAL_MAGIC);
        PICOZIP__WRITE_LE16(file->scratch, 4, entry->version_extract);
        PICOZIP__WRITE_LE16(file->scratch, 6, entry->flags);
        PICOZIP__WRITE_LE16(file->scratch, 8, entry->comp_method);
        picozip__time_to_dostime(entry->mod_time, &dos_date, &dos_time);
        PICOZIP__WRITE_LE16(file->scratch, 10, dos_time);
        PICOZIP__WRITE_LE16(file->scratch, 12, dos_date);
        PICOZIP__WRITE_LE32(file->scratch, 14, entry->crc32);
        PICOZIP__WRITE_LE32(file->scratch, 18, entry->comp_size);
        PICOZIP__WRITE_LE32(file->scratch, 22, entry->uncomp_size);
        PICOZIP__WRITE_LE16(file->scratch, 26, entry->filename_len);
        PICOZIP__WRITE_LE16(file->scratch, 28, entry->extra_field_len);

        /* write header + extra field */
        PICOZIP__FLUSH(file, file->scratch, PICOZIP__LOCAL_HEADER_SIZE, { return PICOZIP_EIO; });
        PICOZIP__FLUSH(file, entry->metadata, entry->filename_len + entry->extra_field_len, { return PICOZIP_EIO; });

        return PICOZIP_OK;
    }

    int picozip_new_entry_mem_ex(picozip_file *file, const char *const path, const uint8_t *data, size_t size, time_t mod_time, const char *const comment, size_t comment_len)
    {
        int err;
        size_t filename_len;
        picozip__entry *entry;

        if (!file || !path || (size && !data) || (comment_len && !comment))
            return PICOZIP_EINVAL;

        filename_len = strlen(path);
        entry = picozip__alloc_entry(file, filename_len + comment_len + PICOZIP__ATTR_SIZE + PICOZIP__LOCAL_TIMESTAMP_SIZE);
        if (!entry)
            return PICOZIP_ENOMEM;

        /* populate the entry */
        entry->version_made = 0;
        entry->version_extract = PICOZIP__MIN_VERSION;
        entry->flags = entry->comp_method = 0;
        entry->internal_attr = entry->external_attr = 0;
        entry->header_offset = file->offset;
        entry->mod_time = mod_time;
        entry->comp_size = entry->uncomp_size = size;
        entry->filename_len = filename_len;
        entry->extra_field_len = PICOZIP__ATTR_SIZE + PICOZIP__LOCAL_TIMESTAMP_SIZE;
        entry->comment_len = comment_len;
        /* calculate the CRC */
        entry->crc32 = picozip__crc32(data, size, PICOZIP__CRC_START);
        /* write the filename */
        memcpy(entry->metadata, path, filename_len);
        /* write the timestamp field */
        PICOZIP__WRITE_LE16(entry->metadata, filename_len, PICOZIP__TIMESTAMP_MAGIC);
        PICOZIP__WRITE_LE16(entry->metadata, filename_len + 2, PICOZIP__LOCAL_TIMESTAMP_SIZE);
        entry->metadata[filename_len + 4] = 1; /* modtime flag set */
        PICOZIP__WRITE_LE32(entry->metadata, filename_len + 5, ((uint32_t)entry->mod_time));
        /* write the comment */
        memcpy(entry->metadata + filename_len + PICOZIP__ATTR_SIZE + PICOZIP__LOCAL_TIMESTAMP_SIZE, comment, comment_len);

        /* write the header to the output */
        if ((err = picozip__write_local_entry(file, entry)) != PICOZIP_OK)
        {
            picozip__free_last_entry(file);
            return err;
        }

        /* write file content */
        PICOZIP__FLUSH(file, data, size, {
            picozip__free_last_entry(file);
            return PICOZIP_EIO;
        });

        return PICOZIP_OK;
    }

    int picozip_new_entry_mem(picozip_file *file, const char *const path, const uint8_t *data, size_t size)
    {
        return picozip_new_entry_mem_ex(file, path, data, size, time(NULL), NULL, 0);
    }

    int picozip_end_ex(picozip_file *file, const char *const comment, size_t comment_len)
    {
        picozip__entry *entry;
        uint16_t dos_date, dos_time;
        size_t cd_size, cd_offset, i;

        if (!file || (comment_len && !comment))
            return PICOZIP_EINVAL;

        cd_size = 0;
        cd_offset = file->offset;
        for (i = 0; i < file->num_entries; i++)
        {
            entry = ((picozip__entry **)file->entries.data)[i];
            PICOZIP__WRITE_LE32(file->scratch, 0, PICOZIP__CENTRAL_MAGIC);
            PICOZIP__WRITE_LE16(file->scratch, 4, entry->version_made);
            PICOZIP__WRITE_LE16(file->scratch, 6, entry->version_extract);
            PICOZIP__WRITE_LE16(file->scratch, 8, entry->flags);
            PICOZIP__WRITE_LE16(file->scratch, 10, entry->comp_method);
            picozip__time_to_dostime(entry->mod_time, &dos_date, &dos_time);
            PICOZIP__WRITE_LE16(file->scratch, 12, dos_time);
            PICOZIP__WRITE_LE16(file->scratch, 14, dos_date);
            PICOZIP__WRITE_LE32(file->scratch, 16, entry->crc32);
            PICOZIP__WRITE_LE32(file->scratch, 20, entry->comp_size);
            PICOZIP__WRITE_LE32(file->scratch, 24, entry->uncomp_size);
            PICOZIP__WRITE_LE16(file->scratch, 28, entry->filename_len);
            PICOZIP__WRITE_LE16(file->scratch, 30, entry->extra_field_len);
            PICOZIP__WRITE_LE16(file->scratch, 32, entry->comment_len);
            PICOZIP__WRITE_LE16(file->scratch, 34, 0); /* disk start */
            PICOZIP__WRITE_LE16(file->scratch, 36, entry->internal_attr);
            PICOZIP__WRITE_LE32(file->scratch, 38, entry->external_attr);
            PICOZIP__WRITE_LE32(file->scratch, 42, entry->header_offset);
            PICOZIP__FLUSH(file, file->scratch, PICOZIP__CD_HEADER_SIZE, { return PICOZIP_EIO; });
            PICOZIP__FLUSH(file, entry->metadata, entry->filename_len + entry->extra_field_len + entry->comment_len, { return PICOZIP_EIO; });
            cd_size += PICOZIP__CD_HEADER_SIZE + entry->filename_len + entry->extra_field_len + entry->comment_len;
        }

        PICOZIP__WRITE_LE32(file->scratch, 0, PICOZIP__EOCD_MAGIC);
        PICOZIP__WRITE_LE16(file->scratch, 4, 0);                  /* disk offset */
        PICOZIP__WRITE_LE16(file->scratch, 6, 0);                  /* central directory disk offset */
        PICOZIP__WRITE_LE16(file->scratch, 8, file->num_entries);  /* total number of records in the disk */
        PICOZIP__WRITE_LE16(file->scratch, 10, file->num_entries); /* total number of records */
        PICOZIP__WRITE_LE32(file->scratch, 12, cd_size);           /* central directory size */
        PICOZIP__WRITE_LE32(file->scratch, 16, cd_offset);         /* central directory offset */
        PICOZIP__WRITE_LE16(file->scratch, 20, comment_len);       /* comment length */
        PICOZIP__FLUSH(file, file->scratch, PICOZIP__EOCD_SIZE, { return PICOZIP_EIO; });

        if (comment)
            PICOZIP__FLUSH(file, comment, comment_len, { return PICOZIP_EIO; });

        return PICOZIP_OK;
    }

    int picozip_end(picozip_file *file)
    {
        return file ? picozip_end_ex(file, NULL, 0) : PICOZIP_EINVAL;
    }

    int picozip_free(picozip_file *file)
    {
        size_t i;

        if (!file)
            return PICOZIP_EINVAL;

        for (i = 0; i < file->num_entries; i++)
        {
            file->free_cb(file->userdata, ((picozip__entry **)file->entries.data)[i]);
        }
        file->free_cb(file->userdata, file->entries.data);
        file->free_cb(file->userdata, file);
        return PICOZIP_OK;
    }

    static void *picozip__mem_alloc(void *userdata, size_t size)
    {
        (void)(userdata);
        return malloc(size);
    }

    static void picozip__mem_free(void *userdata, void *mem)
    {
        (void)(userdata);
        free(mem);
    }

    static size_t picozip__mem_write(void *userdata, const void *mem, size_t len)
    {
        picozip__mem_file *file;
        uint8_t *data;

        file = (picozip__mem_file *)userdata;
        if (!file)
            return 0;

        if (!(data = (uint8_t *)picozip__vec_alloc(&file->mem, len, file->file->alloc_cb, file->file->free_cb, file->file->userdata)))
            return 0;
        memcpy(data + file->mem.size, mem, len);
        file->mem.size += len;

        return len;
    }

    int picozip_new_mem(picozip_file **ofile)
    {
        picozip__mem_file *mem_file;
        int result;

        if (!ofile)
            return PICOZIP_EINVAL;

        if (!(mem_file = (picozip__mem_file *)picozip__mem_alloc(NULL, sizeof(picozip__mem_file))))
            return PICOZIP_ENOMEM;
        memset(mem_file, 0, sizeof(picozip__mem_file));

        result = picozip_new(ofile, picozip__mem_write, picozip__mem_alloc, picozip__mem_free, (void *)mem_file);
        if (result == PICOZIP_OK)
            mem_file->file = *ofile;

        return result;
    }

    size_t picozip_get_mem(picozip_file *file, void **mem)
    {
        if (!file || !file->userdata || !mem)
            return 0;
        *mem = ((picozip__mem_file *)file->userdata)->mem.data;
        return ((picozip__mem_file *)file->userdata)->mem.size;
    }

    int picozip_free_mem(picozip_file *file)
    {
        if (!file || !file->userdata)
            return PICOZIP_EINVAL;

        file->free_cb(file->userdata, ((picozip__mem_file *)file->userdata)->mem.data);
        file->free_cb(file->userdata, file->userdata);
        return picozip_free(file);
    }

#ifndef PICOZIP_NO_STDIO

    int picozip_new_entry_file(picozip_file *file, const char *const path, FILE *fptr, const char *const comment, size_t comment_len)
    {
        size_t filename_len, data_read, file_size;
        uint8_t buffer[PICOZIP_READ_BUF];
        picozip__entry *entry;
        time_t mod_time;
        int err;
#if defined(PICOZIP__WIN) || defined(PICOZIP__UNIX)
        picozip__stat f_stat;
#endif

        if (!file || !path || !fptr || (comment_len && !comment))
            return PICOZIP_EINVAL;

#if defined(PICOZIP__WIN) || defined(PICOZIP__UNIX)
        if (picozip__fstat(picozip__fileno(fptr), &f_stat) != 0)
            return errno;
        mod_time = f_stat.st_mtime;
#else
        mod_time = time(NULL);
#endif

        filename_len = strlen(path);
        entry = picozip__alloc_entry(file, filename_len + comment_len + PICOZIP__ATTR_SIZE + PICOZIP__LOCAL_TIMESTAMP_SIZE);
        if (!entry)
            return PICOZIP_ENOMEM;

        /* populate the entry */
        entry->version_made = 0;
        entry->version_extract = PICOZIP__MIN_VERSION;
        entry->flags = PICOZIP__FLAG_DATADESC;
        entry->comp_method = entry->internal_attr = entry->external_attr = 0;
        entry->header_offset = file->offset;
        entry->mod_time = mod_time;
        entry->comp_size = entry->uncomp_size = entry->crc32 = 0; /* set in data descriptor */
        entry->filename_len = filename_len;
        entry->extra_field_len = PICOZIP__ATTR_SIZE + PICOZIP__LOCAL_TIMESTAMP_SIZE;
        entry->comment_len = comment_len;
        /* write the filename */
        memcpy(entry->metadata, path, filename_len);
        /* write the timestamp field */
        PICOZIP__WRITE_LE16(entry->metadata, filename_len, PICOZIP__TIMESTAMP_MAGIC);
        PICOZIP__WRITE_LE16(entry->metadata, filename_len + 2, PICOZIP__LOCAL_TIMESTAMP_SIZE);
        entry->metadata[filename_len + 4] = 1; /* modtime flag set */
        PICOZIP__WRITE_LE32(entry->metadata, filename_len + 5, ((uint32_t)entry->mod_time));
        /* write the comment */
        memcpy(entry->metadata + filename_len + PICOZIP__ATTR_SIZE + PICOZIP__LOCAL_TIMESTAMP_SIZE, comment, comment_len);

        /* write the header to the output */
        if ((err = picozip__write_local_entry(file, entry)) != PICOZIP_OK)
        {
            picozip__free_last_entry(file);
            return err;
        }

        /* reset CRC */
        entry->crc32 = PICOZIP__CRC_START;
        file_size = 0;
        do
        {
            data_read = fread(buffer, sizeof(uint8_t), PICOZIP_READ_BUF, fptr);
            entry->crc32 = picozip__crc32(buffer, data_read, entry->crc32);
            PICOZIP__FLUSH(file, buffer, data_read, {
                picozip__free_last_entry(file);
                return PICOZIP_EIO;
            });
            file_size += data_read;
        } while (data_read == PICOZIP_READ_BUF);

        entry->comp_size = entry->uncomp_size = file_size;

        /* write data descriptor */
        PICOZIP__WRITE_LE32(file->scratch, 0, PICOZIP__DATADESC_MAGIC);
        PICOZIP__WRITE_LE32(file->scratch, 4, entry->crc32);
        PICOZIP__WRITE_LE32(file->scratch, 8, entry->comp_size);
        PICOZIP__WRITE_LE32(file->scratch, 12, entry->uncomp_size);
        PICOZIP__FLUSH(file, file->scratch, PICOZIP__DATADESC_SIZE, {
            picozip__free_last_entry(file);
            return PICOZIP_EIO;
        });

        return PICOZIP_OK;
    }

    int picozip_new_entry_path(picozip_file *file, const char *const path, const char *const file_path, const char *const comment, size_t comment_len)
    {
        FILE *fptr;
        int err;

        if (!file || !path || !file_path || (comment_len && !comment))
            return PICOZIP_EINVAL;

        /* open the file for reading */
        fptr = fopen(file_path, "rb");
        if (!fptr)
            return errno;

        err = picozip_new_entry_file(file, path, fptr, comment, comment_len);
        fclose(fptr);
        return err;
    }

    static size_t picozip__file_write(void *userdata, const void *mem, size_t len)
    {
        return userdata ? fwrite(mem, 1, len, (FILE *)userdata) : 0;
    }

    int picozip_new_file(picozip_file **ofile, FILE *fptr)
    {
        if (!ofile || !fptr)
            return PICOZIP_EINVAL;

        return picozip_new(ofile, picozip__file_write, picozip__mem_alloc, picozip__mem_free, (void *)fptr);
    }

    int picozip_new_path(picozip_file **ofile, const char *const path, const char *const mode)
    {
        FILE *fptr;

        if (!ofile || !path || !mode)
            return PICOZIP_EINVAL;

        fptr = fopen(path, mode);
        if (!fptr)
            return errno;

        return picozip_new_file(ofile, fptr);
    }

    int picozip_free_path(picozip_file *file)
    {
        if (!file || !file->userdata)
            return PICOZIP_EINVAL;

        fclose((FILE *)file->userdata);
        file->userdata = NULL;
        return picozip_free(file);
    }

#endif /* ifndef PICOZIP_NO_STDIO */

#endif /* ifdef PICOZIP_IMPLEMENTATION */

#if defined(__cplusplus)
}
#endif

#endif /* ifndef PICOZIP_H */

/**
 * Copyright (c) 2024 Takase
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files (the "Software"),
 * to deal in the Software without restriction, including without limitation
 * the rights to use, copy, modify, merge, publish, distribute, sublicense,
 * and/or sell copies of the Software, and to permit persons to whom
 * the Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included
 * in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
 * OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
 * DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE,
 * ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */