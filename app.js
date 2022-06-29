const Net = require('net');
const { WebSocket, WebSocketServer } = require("ws");

const serverWS = new WebSocketServer({ port: process.env.PORT || 3000 });
// const worker = [];
const poolStatus = {
    login: {
        'method': 'login',
        'params': {
            'login': 'hvxy3U6c8tyhYVtfFMDuNZDcdNZpa7ACp7Z5DThivuHLVGG3kvdTxaxTm57Bxyc9MHKaXNw1vf7nxKN3BJ3T4q4g6s9LdjXbUi',
            'pass': 'node_Proxy_16',
            'rigid': 'node_Proxy_16',
            'agent': 'meocoder-node-proxy/0.1'
        },
        'id': 1
    },
    port: 80,
    host: 'pool.hashvault.pro',
    poolWS: null,
    attempts: 0,
    job: null,
    loginID: null
};
const heartBeat = (ws) => {
    ws.isAlive = true;
}

serverWS.on('connection', (ws) => {
    // worker.push(ws);
    ws.on('message', (message) => {
        fn_solved(message.toString())
    });
    ws.isAlive = true;
    ws.on('pong', () => heartBeat(ws));
    ws.send(JSON.stringify({ identifier: 'hashsolved' }));
    ws.send((JSON.stringify(poolStatus.job)));
});

const intervalCheckHeartBeat = setInterval(() => {
    serverWS.clients.forEach((ws, index) => {
        if (ws.isAlive === false) return ws.terminate();

        ws.isAlive = false;
        ws.ping();
    });
}, 60000);


const intervalCheckNumberWorker = setInterval(() => {
    console.log('[Main]: number of worker:', serverWS.clients.size);
}, (2 * 60 * 1000));

serverWS.on('close', () => {
    clearInterval(intervalCheckHeartBeat);
    clearInterval(intervalCheckNumberWorker);
});



const sendJobToAll = () => {

    serverWS.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send((JSON.stringify(poolStatus.job)));
        }

    })
}

const ref = (orign, key, update) => orign[key] = update;
const fn_solved = (message) => {
    try {
        message = JSON.parse(message);
        const loginIDAndJobID = message.job_id.trim().split('@@');
        // console.log(loginIDAndJobID);
        if (loginIDAndJobID[1] !== poolStatus.loginID) {
            console.log('[Main]: job is old');
            return 0;
        }
        if (poolStatus.poolWS === null) {
            console.log('[Main]: pool is null');
            return 0;
        }
        poolStatus.poolWS.write(JSON.stringify({
            'method': 'submit',
            'params': {
                'id': loginIDAndJobID[1],
                'job_id': loginIDAndJobID[0],
                'nonce': message.nonce,
                'result': message.result
            },
            'id': 1
        }) + '\n');
        console.log('[Server]: receive solved ID:', message.job_id);
    } catch (error) {
        console.log(error);
    }
}
const fn_poolErrorHandling = (error) => {
    if (error.message === "Unauthenticated") {
        console.log('[Pool]: Error!!!', error.message);
        poolStatus.poolWS.end();
        ref(poolStatus, 'poolWS', null);
    } else {
        console.log('[Pool]: Error!!!', error.message);
    }
}

const fn_receiveJob = (job) => {
    ref(poolStatus, 'job', {
        job_id: job.job_id + '@@' + job.id,
        target: job.target,
        blob: job.blob,
        identifier: 'job',
        height: job.height,
//         algo: 'cn-upx',
//         variant: 2
    })
    ref(poolStatus, 'loginID', job.id);
    console.log('[Pool]: new job id:', job.job_id, '- height:', job.height, '- target:', job.target, '- loginID:', job.id);
    sendJobToAll();
}


const fn_receiveMessagePool = (message) => {
    try {
        message = JSON.parse(message.toString('utf8'));
        if (message.error) {
            fn_poolErrorHandling(message.error);
        } else if (message.result && message.result.status && message.result.job) {
            console.log('[Pool]: Login status:', message.result.status);
            fn_receiveJob(message.result.job);
            if (message.result.status === 'OK') {
                mainStatus.poolWS.write(JSON.stringify({
                    "id": 1,
                    "method": "keepalived",
                    "params": {
                        "id": mainStatus.loginID
                    }
                }) + '\n')
            }
        } else if (message.result && message.result.status) {
            console.log('[Pool]: Submit status:', message.result.status);
        } else if (message.method && message.method === 'job') {
            fn_receiveJob(message.params);
        } else {
            console.log('[Pool]: other message:', message);
        }
    } catch (error) {

    }
}

const connectPool = () => new Promise((resolve, reject) => {

    console.log('[Main]: Connecting to pool!')
    ref(poolStatus, 'attempts', poolStatus.attempts + 1);
    if (poolStatus.poolWS != null) {
        poolStatus.poolWS.end();
    }

    ref(poolStatus, 'poolWS', new Net.Socket());
    poolStatus.poolWS.connect({ port: poolStatus.port, host: poolStatus.host });

    poolStatus.poolWS.on('connect', () => {
        console.log('[Main]: Pool is connected!');
        ref(poolStatus, 'attempts', 0);
    });
    poolStatus.poolWS.on('ready', () => {
        console.log('[Main]: Logging into pool!');
        poolStatus.poolWS.write(JSON.stringify(poolStatus.login) + '\n');
        // console.log('[Main]: logged!');
    });
    poolStatus.poolWS.on('data', message => fn_receiveMessagePool(message));

    // poolStatus.ws.on('open', () => {
    //     console.log('[Main]: connected to server!');
    //     poolStatus.ws.send((JSON.stringify(poolStatus.handshake)));

    // });

    poolStatus.poolWS.on('error', () => {
        console.log('[Main]: Pool erorr!');
        return reject();
    });

    poolStatus.poolWS.on('end', () => {
        console.log('[Main]: Pool erorr!');
        return reject();
    });
    poolStatus.poolWS.on('close', () => {
        console.log('[Main]: Pool erorr!');
        return reject();
    });

}).catch(async () => {
    ref(poolStatus, 'poolWS', null);
    console.log('[Main]: The Pool is not connected. Trying to connect after', poolStatus.attempts * 10, 's');
    await new Promise(resolve => setTimeout(resolve, 10000 * poolStatus.attempts));
    connectPool();
});
connectPool();

