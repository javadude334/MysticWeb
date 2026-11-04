# Mystic Linux A48 binary reference

`mys112a48_l32(1).rar` contained `install_data.mys`; extracted `mystic_elf32` is stripped, dynamically linked, Intel i386 ELF32 (1,224,168 bytes). SHA-256: `2d02b37ea2910eda0ef9741061910c43e4eb0bede27353e50fb9a0f01d90aef3`.

Recovery ZIP includes ELF, `mystic_disassembly.asm`, `extracted_strings.txt`, `acs_related_strings.txt`, `elf_structure.txt`, SHA256 checksums and `ghidra/ExportAllFunctions.java`. Ghidra must be run separately to produce `mystic_all_functions.c`; this output has **not** been generated or validated. Stripped binaries lose original source names/comments; exported C-like code is pseudocode, not compilable original source. Linux/Windows behavior may differ.

Record executable checksum, decompiler version, function address, evidence and failure logs for each recovered routine. Do not execute legacy binaries on production hosts.
