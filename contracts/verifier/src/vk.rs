// Verification key bytes exported by Phase 1 (`pnpm zk:build`).
// Replace the contents of `vk.bin` at build time with the real VK; this file
// only references it so the wasm embeds the bytes. NO secrets — the VK is public.
pub const VERIFICATION_KEY: &[u8] = include_bytes!("../vk.bin");
