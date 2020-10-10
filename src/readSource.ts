import { openSync, readSync } from "fs";
type FileDescriptor = number;
type FilePath = string;

export const readPCMF32LEMono = (ab: ArrayBuffer) => {
  const floats = [];
  const fl = new Float32Array(ab);
  const abf = [];
  for (let i = 0; i < ab.byteLength; i += 4) {
    if (ab[i] & 0x80) {
      floats.push(((ab[i + 3] | ab[i + 2] << 8 | ab[i + 1] << 16 | ab[i] << 24) - 1) / 0x80000000);
    } else {
      floats.push((ab[i + 3] | ab[i + 2] << 8 | ab[i + 1] << 16 | ab[i] << 24) / 0xffffffff);
    }
  }
  return floats;
};

export const readBuffer = (file: FilePath) => {
  const fd: FileDescriptor = openSync(file, 'r');
  const l = 44100 * 4;
  let fptr = 0;
  const ob = Buffer.alloc(l);
  return function read() {
    readSync(fd, ob, 0, l, fptr += l);
    return readPCMF32LEMono(ob);
  }
}



let reader;
process.stdin.on("data", (d) => {
  reader = reader || readBuffer("./flac.pcm");
  process.stdout.write(reader.read());
});