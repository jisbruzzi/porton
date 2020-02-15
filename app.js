let port=3000, fs = require('fs'),
    util=require("util"),
    request=util.promisify(require("request")),
    net=require("net");


var log = function(entry) {
    console.log(entry);
    fs.appendFileSync('/tmp/sample-app.log', new Date().toISOString() + ' - ' + entry + '\n');
};

const express = require('express')
const app = express()
app.set('trust proxy', true)

app.get('/', (req, res) => res.send('Hello World!'))

app.listen(port, () => log(`Example app listening on port ${port}!`))
log('Server running at http://127.0.0.1:' + port + '/');




// ------------------ servidor tcp --------------- //
const dgram = require('dgram')

let Client=function(localPort){
    
    let socket=dgram.createSocket("udp4")
    let clientAddress=null;
    let clientPort=null;
    let onReceive=null;
    let onError=null;
    
    socket.on('error', (err) => {
        log(`server error:\n${err.stack}`);
        socket.close();
        if(onError!=null){
            onError(err)
            onError=null;
        }
    });

    socket.on('message', (msg, rinfo) => {
        log(`server got: ${msg} from ${rinfo.address}:${rinfo.port}`)
        clientAddress=rinfo.address
        clientPort=rinfo.port
        log("onReceive is null?" + (onReceive==null?true:false))
        if(onReceive!=null){
            log("call on receive")
            onReceive(msg)
            onReceive=null;
        }
    });

    socket.on('listening', () => {
        const address = socket.address();
        log(`server listening ${address.address}:${address.port}`);
    });
    
    socket.bind(localPort);
    

    function sendMessage(message){
        if(clientPort==null || clientAddress==null){
            throw new Error("no se recibió nada todavía")
        }
        log(message)
        log(clientPort)
        log(clientAddress)
        socket.send(message,clientPort,clientAddress);
    }

    function setOnReceive(fn){
        onReceive=fn;
    }

    function setOnError(fn){
        onError=fn;
    }

    return {
        sendMessage,
        setOnReceive,
        setOnError,
    };
}

let communication=(function(){
    let clients = {}
    let east="east"
    let west="west"

    function initialize(){
        clients[east]=Client(54321)
        clients[west]=Client(54322)
    }

    async function sendAndWait(message,clients){
        async function sendAndWaitOne(client){
            return new Promise((resolve,reject)=>{
                try {

                    client.setOnReceive(resolve)
                    client.setOnError(reject)
                    client.sendMessage(message)    
                } catch (error) {
                    reject(err)
                }
            })
        }
        log("about to get responses:")
        let responses = await Promise.allSettled(clients.map(sendAndWaitOne));
        return JSON.stringify(responses.filter(p=>p.status=="fulfilled").map(p=>p.value.toString("utf8")));
    }

    initialize();
    return {
        abrir:async ()=>await sendAndWait("a",[clients[east]]),
        cerrar:async ()=>await sendAndWait("c",[clients[east]]),
        mover:async ()=>await sendAndWait("m",[clients[west]]),
        estado:async ()=>await sendAndWait("e",[clients[east],clients[west]]),
    }
})()



app.get("/estado",async (req,res)=>res.send(await communication.estado()))
app.get("/abrir",async (req,res)=>res.send(await communication.abrir()))
app.get("/cerrar",async (req,res)=>res.send(await communication.cerrar()))
app.get("/mover",async (req,res)=>res.send(await communication.mover()))
