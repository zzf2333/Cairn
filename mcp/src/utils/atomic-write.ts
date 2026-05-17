import { writeFile, rename, unlink } from "node:fs/promises";

let counter = 0;

export async function atomicWriteFile(path: string, content: string | Buffer): Promise<void> {
    const tmp = `${path}.tmp.${process.pid}.${Date.now()}.${counter++}`;
    try {
        await writeFile(tmp, content as any, typeof content === "string" ? "utf-8" : undefined);
        await rename(tmp, path);
    } catch (err) {
        try {
            await unlink(tmp);
        } catch {
            // ignore
        }
        throw err;
    }
}
