const wrtc = require("wrtc");
const { RTCPeerConnection, RTCSessionDescription } = wrtc;
const { RTCAudioSink, RTCAudioSource } = wrtc.nonstandard;
const iceServers = require("./lib/iceServers");
const connections = [];
import { openSync, readSync } from 'fs';
const server = require("http").createServer(async (req, res) => {
  if (req.method === "POST") handlePOST(req, res);
  else handleGET(req, res);
});



async function handleGET(req, res) {
  try {
    const pc = new RTCPeerConnection({
      sdpSemantics: "unified-plan",
      RTCIceServers: iceServers,
    });
    connections.push(pc);
    pc.id = connections.length;

    const gatheredCans = [];
    const iceCanGatherDone = new Promise((resolve) => {
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
    const transceiver = pc.addTransceiver("audio");
    pc.addTrack(strack);
    const track = transceiver.receiver.track;
    const file = openSync("./flac.pcm", 'r');
    const l = 44100 * 4;
    let fptr = 0;
    const ob = Buffer.alloc(l);
    setInterval(() => {
      const samples = readSync(file, ob, 0, l, fptr += l);

      track.ondata({
        samples,
        sampleRate: 44100,
        bitsPerSample: 32,
        channelCount: 2,
        numberOfFrames: samples.length
      });
    }, 1000);
    const sink = new RTCAudioSink(track);
    const dataChannel = pc.createDataChannel("frequency");
    const writable = require("fs").createWriteStream("soundin");
    sink.ondata = (data) => {
      console.log(data.samples.length);
      writable.write(Buffer.from(data.samples));
    };
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
      id: pc.id,
      localDescription: pc.localDescription,
      candidates: gatheredCans,
    })};
  const config = ${JSON.stringify({
      sdpSemantics: "unified-plan",
      RTCIceServers: iceServers,
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
    const post  = JSON.stringify({sdp:bpc.localDescription, id:${pc.id}});
  const { gatheredCandidates } = await fetch("http://localhost:3000/${pc.id}", {
    method: "POST",
    body: post,
    length: body.length,
    headers: {
      "Content-Type": "application/json",
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

function handlePOST(req, res) {

  let d = [];
  req.on("data", (c) => d.push(c));
  req.on("doen", async () => {
    const json = JSON.parse(Buffer.concat(d).toString());
    const pc = connections[connections.length - 1];
    await pc.setRemoteDescription(json.sdp);
    res.end(JSON.stringify(pc.iceConnectionState))
  });
}

server.listen(3000);
