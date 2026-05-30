const express = require("express");
const app = express();

const { join } = require("node:path");

const port = 3000;

const { Server } = require("socket.io");

const { createServer } = require("node:http");

const server = createServer(app);

const io = new Server(server);

// =========================
// ARQUIVOS ESTÁTICOS
// =========================

app.use(express.static("public"));

// =========================
// MAPA
// =========================

const LARGURA_MAPA = 1920;
const ALTURA_MAPA = 1080;

// =========================
// ESTADO DO JOGO
// =========================

const jogadores = {};

const projeteis = [];

// =========================
// ROTA PRINCIPAL
// =========================

app.get("/", (req, res) => {

    res.sendFile(join(__dirname, "index.html"));

});

// =========================
// SOCKET CONNECTION
// =========================

io.on("connection", (socket) => {

    console.log("Jogador entrou:", socket.id);

    // cor aleatória
    const corAleatoria =
        "#" +
        Math.floor(Math.random() * 0xffffff)
            .toString(16)
            .padStart(6, "0");

    // criar jogador
    jogadores[socket.id] = {

        x: Math.random() * 1000 + 100,
        y: Math.random() * 500 + 100,

        tamanho: 50,

        velocidade: 5,

        vida: 100,

        angulo: 0,

        cor: corAleatoria

    };

    // =========================
    // MOVIMENTO
    // =========================

    socket.on("dados_jogo", (dados) => {

        const jogador = jogadores[socket.id];

        if (!jogador) return;

        const teclas = dados.teclas_pressionadas || {};

        jogador.angulo = dados.angulo || 0;

        // movimento
        if (teclas["w"]) jogador.y -= jogador.velocidade;
        if (teclas["s"]) jogador.y += jogador.velocidade;

        if (teclas["a"]) jogador.x -= jogador.velocidade;
        if (teclas["d"]) jogador.x += jogador.velocidade;

        // limites
        if (jogador.x < 0)
            jogador.x = 0;

        if (jogador.y < 0)
            jogador.y = 0;

        if (jogador.x + jogador.tamanho > LARGURA_MAPA)
            jogador.x = LARGURA_MAPA - jogador.tamanho;

        if (jogador.y + jogador.tamanho > ALTURA_MAPA)
            jogador.y = ALTURA_MAPA - jogador.tamanho;

    });

    // =========================
    // ATIRAR
    // =========================

    socket.on("atirar", () => {

        const jogador = jogadores[socket.id];

        if (!jogador) return;

        const velocidadeProjetil = 15;

        const projetil = {

            x: jogador.x + jogador.tamanho / 2,

            y: jogador.y + jogador.tamanho / 2,

            velocidade_x:
                Math.cos(jogador.angulo) *
                velocidadeProjetil,

            velocidade_y:
                Math.sin(jogador.angulo) *
                velocidadeProjetil,

            raio: 6,

            dano: 10,

            dono: socket.id

        };

        projeteis.push(projetil);

    });

    // =========================
    // DESCONECTAR
    // =========================

    socket.on("disconnect", () => {

        console.log("Jogador saiu:", socket.id);

        delete jogadores[socket.id];

    });

});

// =========================
// GAME LOOP
// =========================

setInterval(() => {

    // =========================
    // ATUALIZAR PROJÉTEIS
    // =========================

    for (let i = projeteis.length - 1; i >= 0; i--) {

        const p = projeteis[i];

        // mover
        p.x += p.velocidade_x;
        p.y += p.velocidade_y;

        // remover fora da tela
        if (

            p.x < 0 ||
            p.y < 0 ||

            p.x > LARGURA_MAPA ||
            p.y > ALTURA_MAPA

        ) {

            projeteis.splice(i, 1);

            continue;
        }

        // =========================
        // COLISÃO
        // =========================

        for (let id in jogadores) {

            const jogador = jogadores[id];

            // não acertar dono
            if (id === p.dono)
                continue;

            const centroX =
                jogador.x + jogador.tamanho / 2;

            const centroY =
                jogador.y + jogador.tamanho / 2;

            const dx = p.x - centroX;
            const dy = p.y - centroY;

            const distancia =
                Math.sqrt(dx * dx + dy * dy);

            // colisão
            if (distancia < jogador.tamanho / 2) {

                jogador.vida -= p.dano;

                // morreu
                if (jogador.vida <= 0) {

                    jogador.vida = 100;

                    jogador.x =
                        Math.random() * 1000 + 100;

                    jogador.y =
                        Math.random() * 500 + 100;
                }

                // remove projetil
                projeteis.splice(i, 1);

                break;
            }

        }

    }

    // =========================
    // ENVIAR ESTADO
    // =========================

    io.emit("estado_jogo", {

        jogadores,
        projeteis

    });

}, 1000 / 60);

// =========================
// SERVIDOR
// =========================

server.listen(port, () => {

    console.log(
        `Servidor rodando em http://localhost:${port}`
    );

});