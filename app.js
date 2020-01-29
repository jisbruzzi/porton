var port = process.env.PORT || 3000,
    fs = require('fs'),
    util=require("util"),
    request=util.promisify(require("request"));


var log = function(entry) {
    console.log(entry);
    fs.appendFileSync('/tmp/sample-app.log', new Date().toISOString() + ' - ' + entry + '\n');
};

const express = require('express')
const app = express()
app.set('trust proxy', true)

app.get('/', (req, res) => res.send('Hello World!'))


let ipTerminales={}

function ping(origen,req,res){
    log("ping desde " + origen + " desde la ip " + req.ip)
    let ip=req.query.ip || "http://"+req.ip
    ipTerminales[origen]=ip;
    res.send("Recibo un mensaje "+origen+" desde " + req.ip + "la ip que almaceno es:"+ ip);
}

app.get("/pingOriental",ping.bind(null,"oriental"))
app.get("/pingOccidental",ping.bind(null,"occidental"))
app.get("/estado",async (req,res)=>{
    let promesas=[]
    let golpes=[]
    function agregarPromesa(origen){
        if(ipTerminales[origen]){
            let url=ipTerminales[origen]+"/estado";
            golpes.push(url)
            promesas.push(request(url))
        }
    }
    agregarPromesa("occidental")
    agregarPromesa("oriental")
    let resueltas =[]
    try{
        resueltas = await Promise.all(promesas)
    }catch(e){
        log(e)
        res.status(400).send("400: intenté pegarle a:"+ golpes.join(" y además a ") +"" +e+""+ JSON.stringify(e));
    }
     
    if(resueltas.length==0){
        res.status(400).send("400:No hay ningún terminal registrado, Juan")
    }
    let texto=resueltas.map(res=>JSON.stringify(res)).reduce((a,b)=>a+"\n"+b,"")
    res.send(texto);
})

async function proxySiPuede(destino,ruta,req,res){
    if(ipTerminales[destino]){
        try{
            let resultado = await request(ipTerminales[destino]+ruta)
            res.send(JSON.stringify(resultado))
        }catch(e){
            log(e)
            res.status(400).send("400"+e+""+JSON.stringify(e))
        }
    }else{
        res.status(400).send("400:No hay ningún terminal "+destino+" registrado.")
    }
}
app.get("/abrirOccidental",proxySiPuede.bind(null,"occidental","/abrir"))
app.get("/cerrarOccidental",proxySiPuede.bind(null,"occidental","/cerrar"))
app.get("/moverOriental",proxySiPuede.bind(null,"oriental","/mover"))

app.listen(port, () => log(`Example app listening on port ${port}!`))
log('Server running at http://127.0.0.1:' + port + '/');
