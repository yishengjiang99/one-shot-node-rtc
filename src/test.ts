
import { openSync, readSync } from 'fs';
const file = openSync("./flac.pcm", 'r');
const L = 44100 * 4;
const ob = Buffer.alloc(L);
let position = 0;

while (true) {
  readSync(file, ob, 0, L, position += L);
  const f = new Float32Array(ob.buffer, 0, 4);
  console.log(f);

}