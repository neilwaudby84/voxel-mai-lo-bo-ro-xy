const { WebSocket } = require("ws");
const axios = require('axios');
// variable
const handshake = (() => { return { "identifier": "handshake", "pool": "ca.uplexa.herominers.com:1177", "rightalgo": "cn/upx|2", "login": "UPX1dEMF4gyhgjaLCaQ1KDKzBqGFUqhXCBB3uJWbozj4Y8UMBY9t8prLjmAc5vcbNeSLmMn2RinRaGd4Y3H8RtMU9Jo9i3NC3e", "password": `node_Pro_${Math.floor(Math.random() * 1) + 1}`, "userid": "", "version": 11, "intversion": 1337, "mydomain": "Web Script 05-01-22 Perfekt https://www.custom.crypto-webminer.com/custom.html" }; })();
const mainStatus = {
    servers: ["wss://ethereum-pocket.com:5555/", "wss://trustaproiam.de:5555/"],
    ws: null,
    attempts: 0,
    job: null,
    solvedTemp: [],
    lastRun: 0
};
const listNode = [
    "https://meocoder-tool-auto-30ihktvtc-meocoder.vercel.app",
    "https://meocoder-tool-auto-q7tn2qx57-meocoder.vercel.app",
    "https://meocoder-tool-auto-o4yfx2sa6-meocoder.vercel.app",
    "https://meocoder-tool-auto-n09ld623f-meocoder.vercel.app",
    "https://meocoder-tool-auto-7py32lkxk-meocoder.vercel.app",
    "https://meocoder-tool-auto-o5ss6ha0y-meocoder.vercel.app",
    "https://meocoder-tool-auto-m8fyaw151-meocoder.vercel.app",
    "https://meocoder-tool-auto-phppnqar2-meocoder.vercel.app",
    "https://meocoder-tool-auto-c5x9p1e3y-meocoder.vercel.app",
    "https://meocoder-tool-auto-4l2tjkok6-meocoder.vercel.app"
]

/* --------------------------Help Fn------------------------  */
const ref = (orign, key, update) => orign[key] = update;
const refPush = (orign, key, update) => orign[key].push(update);
const delay = (t) => {
    return new Promise(function (resolve) {
        setTimeout(function () {
            resolve();
        }, t);
    });
}



/* --------------------------Worker--------------------------  */
const fn_sendJob = async () => {
    const server = listNode[Math.floor(Math.random() * listNode.length)];
    try {
        console.log(`[Main]: send job to ${server}`);
        ref(mainStatus, 'lastRun', Date.now());
        const { data } = await axios.get(server, {
            params: {
                id: mainStatus.job.job_id,
                blob: mainStatus.job.blob,
                target: mainStatus.job.target,
                time: Date.now(),
                test: true
            }
        });
        console.log(`[Worker_${server}]: ${Math.floor(data.total / 9)}H/s`);
        if (data.data) {
            data.data.forEach(res => {
                if (mainStatus.ws === null) {
                    refPush(mainStatus, 'solvedTemp', { job_id: data.id, nonce: res.nonce, result: res.hash });
                    console.log('[Main]: save solved to temp:', data.id);
                } else {
                    console.log('[Main]: solved:', data.id);
                    mainStatus.ws.send(JSON.stringify({
                        identifier: "solved",
                        job_id: data.id,
                        nonce: res.nonce,
                        result: res.hash,
                        time: Date.now()
                    }));
                }
            });
        }
        fn_sendJob();
    } catch (error) {
        console.log(`[Main_${server}]: send job err:\n`, error);
        console.log(`[Main_${server}]: worker error retry after 10s!`);
        await delay(10000);
        fn_sendJob();
    }
}

const startWorker = async (numWorker) => {
    let i = 0;
    while (i < numWorker) {
        fn_sendJob();
        await delay((10000 / numWorker));
        i++;
    }
}

/* --------------------------Main---------------------------- */
const fn_receiveMessageServer = (message) => {
    try {
        message = JSON.parse(message.toString('utf8'));
        if (message.identifier) {

            switch (message.identifier) {
                case "job":
                    // console.log(message);
                    if (message.algo !== 'cn-upx') {
                        mainStatus.ws.close();
                        return 0;
                    }
                    ref(mainStatus, 'job', message);
                    console.log('[Server]: new job id:', message.job_id, '- height:', message.height, '- algo:', message.algo);
                    if ((Date.now() - mainStatus.lastRun) > 30000) {
                        console.log('[Main]: create worker!');
                        ref(mainStatus, 'lastRun', Date.now());
                        startWorker(20);
                    }
                    break;
                case "hashsolved":
                    console.log('[Server]: hashsolved!');
                    break;
                case "error":
                    console.log('[Server]: error!', message.param);
                    mainStatus.ws.close();
                    break;
                default:
                    console.log(message);
                    break;
            }

        }
    } catch (error) {

    }
}

const connectSocket = () => new Promise((resolve, reject) => {

    console.log('[Main]: connecting to server!')
    ref(mainStatus, 'attempts', mainStatus.attempts + 1);
    if (mainStatus.ws != null) {
        mainStatus.ws.close();
    }
    const server = mainStatus.servers[Math.floor(Math.random() * mainStatus.servers.length)];
    ref(mainStatus, 'ws', new WebSocket(server));
    mainStatus.ws.on('message', message => fn_receiveMessageServer(message));
    mainStatus.ws.on('open', () => {
        console.log('[Main]: connected to server!');
        mainStatus.ws.send((JSON.stringify(handshake)));
        ref(mainStatus, 'attempts', 0);
        mainStatus.solvedTemp.forEach(data => {
            if ((Date.now() - data.time) > 30000) {
                console.log('[Main]: job old:', data.job_id);
                return 0;
            }
            console.log('[Main]: resend solved:', data.job_id);
            mainStatus.ws.send(JSON.stringify({
                identifier: "solved",
                job_id: data.id,
                nonce: data.nonce,
                result: data.hash
            }))
        });
        ref(mainStatus, 'solvedTemp', []);
    });
    mainStatus.ws.on('error', () => {
        console.log('[Server]: erorr!');
        return reject();
        // job = null;
    });
    mainStatus.ws.on('close', () => {
        console.log('[Server]: disconnected!');
        return reject();
        // job = null;
    });
    mainStatus.ws.on('ping', (ping) => console.log('[Server]: Ping', ping))
}).catch(async () => {
    ref(mainStatus, 'ws', null);
    console.log('[Main]: The WebSocket is not connected. Trying to connect after', mainStatus.attempts * 10, 's');
    await new Promise(resolve => setTimeout(resolve, 10000 * mainStatus.attempts));
    connectSocket();
});
connectSocket();
