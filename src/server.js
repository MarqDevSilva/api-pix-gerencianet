if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config()
}

const express = require('express');
const bodyParser = require('body-parser');
const GNRequest = require('./apis/gerencianet');

const app = express();

app.use(bodyParser.json());

app.set('view engine', 'ejs');
app.set('views', 'src/views');

let reqGNAlready = GNRequest({
  clientID: process.env.GN_CLIENT_ID,
  clientSecret: process.env.GN_CLIENT_SECRET
});

async function restartReqGN() {
  reqGNAlready = await GNRequest({
    clientID: process.env.GN_CLIENT_ID,
    clientSecret: process.env.GN_CLIENT_SECRET
  });
}

setInterval(restartReqGN, 3600000);

const clients = [];

function handlePixWebhook(data) {
  clients.forEach(client => {
      console.log(client)
      client.write(`data: ${JSON.stringify(data)}\n\n`);
  });
}

app.get('/sse', (req, res) => {
  // Configura os cabeçalhos da resposta SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  });

  // Função para enviar um ping para o cliente a cada 40 segundos
  const sendPing = () => {
    res.write(': ping\n\n');
  };

  // Chama a função sendPing inicialmente e a cada 40 segundos
  const pingInterval = setInterval(sendPing, 40000);

  // Registra o cliente na lista
  const clientIndex = clients.push(res) - 1;

  // Limpa o intervalo e remove o cliente da lista quando a conexão é fechada pelo cliente
  req.on('close', () => {
    clearInterval(pingInterval);
    clients.splice(clientIndex, 1);
  });
});


app.get('/pix', async (req, res) => {
  const reqGN = await reqGNAlready;
  const valor = req.query.valor;
  const dataCob = {
    calendario: {
      expiracao: 3600
    },
    valor: {
      original: valor
    },
    chave: 'e6ada153-6d47-4e8d-a3a8-96dbde7ed7e3',
    solicitacaoPagador: 'Inscrição Congresso GYC'
  };
  
  const cobResponse = await reqGN.post('/v2/cob', dataCob);
  const qrcodeResponse = await reqGN.get(`/v2/loc/${cobResponse.data.loc.id}/qrcode`);

  res.status(200).json({
    cobResponse: cobResponse.data,
    qrcodeResponse: qrcodeResponse.data
  });
});

app.post('/webhook(/pix)?', (req, res) => {
  console.log(req.body);

  handlePixWebhook(req.body);

  res.send('200');
});

app.listen(8000, () => {
  console.log('running');
})
