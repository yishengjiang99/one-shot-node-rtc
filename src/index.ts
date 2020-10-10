const wrtc = require("wrtc");
const { RTCPeerConnection } = wrtc;
const { RTCAudioSource } = wrtc.nonstandard;
const { IceServers } = require("./IceServers");
const connections: Record<string, RTCPeerConnection> = {};
import { IncomingMessage, ServerResponse, createServer } from 'http';
const server = createServer((req: IncomingMessage, res: ServerResponse) => {
  if (req.method === "POST") handlePOST(req, res);
  else handleGET(res).then
});



async function handleGET(res: ServerResponse) {
  try {
    const pc: RTCPeerConnection = new RTCPeerConnection({
      sdpSemantics: "unified-plan",
      RTCIceServers: IceServers,
    });
    const id = require('uuidv1')();

    connections[id] = pc;

    const gatheredCans: RTCIceCandidate[] = [];
    const iceCanGatherDone = new Promise<void>((resolve) => {
      pc.addEventListener("icecandidate", ({ candidate }) => {
        if (!candidate) resolve();
        else gatheredCans.push(candidate);
      });
      pc.oniceconnectionstatechange = () => {
        switch (pc.iceConnectionState) {
          case "connected":
          case "completed":
            resolve();
            break;
          case "disconnected":
          case "failed":
            res.writeHead(500, "ice connection failed or disconnected");
            return;
        }
      };
    });
    const source = new RTCAudioSource();
    const strack = source.createTrack();

    pc.addTrack(strack);
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") {
        const sampleRate = 44100;
        const numberOfFrames = sampleRate / 100;
        const secondsPerSample = 1 / sampleRate;
        const channelCount = 2;
        const samples = new Int16Array(channelCount * numberOfFrames);
        const bitsPerSample = 16;
        const data = {
          samples,
          sampleRate,
          bitsPerSample,
          channelCount,
          numberOfFrames
        };
        let time = 0;
        const maxv = Math.pow(2, bitsPerSample) / 2 - 1;
        let a = [0.2, 0.5];
        function next() {
          for (let i = 0; i < numberOfFrames; i++, time += secondsPerSample) {
            for (let j = 0; j < channelCount; j++) {
              samples[i * channelCount + j] = a[j] * Math.sin(3.1 * 333 * time) * maxv;
            }
          }
          console.log(data.samples.subarray(0, 10))
          source.onData(data);
          // eslint-disable-next-line
          setTimeout(next, 10);
        }
        setTimeout(next);
      }
    }
    // const transceiver = pc.addTransceiver("audio");

    // const track = transceiver.receiver.track;
    // const sink = new RTCAudioSink(track);
    // const writable = require("fs").createWriteStream("soundin");
    // sink.ondata = (data: ) => {
    //   writable.write(data);
    // };
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await iceCanGatherDone;
    const html = /* html */ ` 
      <html>
        <body>
          <video id="local" controls></video>
          <video id="remote" controls></video>
          <script async>
(async function main(){
  const remotePeerConnection = ${JSON.stringify({
      id: id,
      localDescription: pc.localDescription,
      candidates: gatheredCans,
    })};
  const config = ${JSON.stringify({
      sdpSemantics: "unified-plan",
      RTCIceServers: IceServers,
    })};
  const localVideo = document.querySelector("#local");
  const remoteVideo = document.querySelector("#remote");
  const bpc = new RTCPeerConnection(config);
  await bpc.setRemoteDescription(remotePeerConnection.localDescription);
  const localStream = await window.navigator.mediaDevices.getUserMedia({
    audio: true,
  });
  remotePeerConnection.candidates.forEach((candidate) => {
    if (candidate !== null) bpc.addIceCandidate(candidate);
  });
  localStream
    .getTracks()
    .forEach((track) => bpc.addTrack(track, localStream));

  localVideo.srcObject = localStream;

  const remoteStream = new MediaStream(
    bpc.getReceivers().map((receiver) => receiver.track)
  );
  remoteVideo.srcObject = remoteStream;

  const originalAnswer = await bpc.createAnswer();
  await bpc.setLocalDescription(originalAnswer);
   const post  = JSON.stringify({sdp:bpc.localDescription, id:'${id}'});
  const { gatheredCandidates } = await fetch("http://localhost:3000/${id}", {
    method: "POST",
    body: post,
    headers: {
      "Content-Type": "application/json",
      "Content-Length": post.length
    },
  }).then((res) => res.json());

  gatheredCandidates.forEach((candidate) => {
    if (candidate !== null) bpc.addIceCandidate(candidate);
  }); 
})()
          </script>
        </body>
      </html>`;
    res.end(html);
  } catch (error) {
    console.error(error);
    res.writeHead(500);
    res.end();
  }
}

const handlePOST = (req: IncomingMessage, res: ServerResponse) => {
  let d = ""
  const length = parseInt(req.headers['content-length'] || "0");
  req.on("data", (c: any) => {
    d += c.toString();
    console.log(d.length);
    if (d.length >= length) {
      const json = JSON.parse(d);
      const pc = connections[json.id];
      pc.setRemoteDescription(json.sdp).then(() => {
        res.end(JSON.stringify(pc.iceConnectionState))

      });
    }
  });

}

server.listen(3000);
