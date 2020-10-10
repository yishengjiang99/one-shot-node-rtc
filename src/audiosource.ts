import { openSync, readSync } from "fs";
type FileDescriptor = number;
type FilePath = string;

export const readBuffer = (file: FilePath) => {
  const fd: FileDescriptor = openSync(file, 'r');
  const l = 44100 * 8;
  let fptr = 0;
  const ob = Buffer.alloc(l);
  return {
    framesRead: l,

    getBytes: function () {
      readSync(fd, ob, 0, l, fptr += l)
      return new Int32Array(ob);
    },
  }
}

