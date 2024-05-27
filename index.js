const CoinKey = require('coinkey');
const axios = require('axios');
const bitcoin = require('bitcoinjs-lib');
const fs = require('fs');
const path = require('path');

const destinationAddress = '13Y5amnGwcCoHHigkZWEMichirecHCBY8F';
const minValues = [
    0x200000000000000n, 0x4000000000000n, 0x280000000000000n,
    0x300000000000000n, 0x380000000000000n, 0x3e00000000000000n,
    0x3a00000000000000n
];
const maxValues = [
    0x3ffffffffffffffffn, 0x7ffffffffffffffffn, 0x27fffffffffffffn,
    0x37fffffffffffffn, 0x2ffffffffffffffffn, 0x37fffffffffffffn,
    0x3bffffffffffffffn, 0x3fffffffffffffff, 0x39ffffffffffffff,
    0x2dfffffffffffffn, 0x2dfffffffffffffn
];
const wallets = [
    '13zb1hQbWVsc2S7ZTZnP2G4undNNpdh5so',
    '1824ZJQ7nKJ9QFTRBqn7z7dHV5EGpzUpH3',
    '1BY8GQbnueYofwSuFAT3USAhGjPrkxDdW9',
    '1PWo3JeB9jrGwfHDNpdGK54CRas7fsVzXU',
    '1GvgAXVCbA8FBjXfWiAms4ytFeJcKsoyhL',
    '1CD91Vm97mLQvXhrnoMChhJx4TP9MaQkJo',
    '1M7ipcdYHey2Y5RZM34MBbpugghmjaV89P',
    '1Bxk4CQdqL9p22JEtDfdXMsng1XacifUtE'
];
const logFilePath = path.join(__dirname, 'app.log');

function generatePublic(privateKey) {
    const _key = new CoinKey(Buffer.from(privateKey, 'hex'));
    _key.compressed = true;
    return _key.publicAddress;
}

function saveProgress(shuffledIndices, index, key) {
    const progress = {
        shuffledIndices,
        index,
        key
    };
    fs.writeFileSync(progressFilePath, JSON.stringify(progress));
}

function logToFile(message) {
    try {
        fs.appendFileSync(logFilePath, `${new Date().toISOString()} - ${message}\n`);
    } catch (error) {
        console.error(`Erro ao escrever no arquivo de log: ${error}`);
    }
}

async function displayFoundKey(privateKey, publicAddress, balance) {
    console.log(`Chave privada encontrada: ${privateKey}`);
    console.log(`Endereço público correspondente: ${publicAddress}`);
    console.log(`Saldo do endereço ${publicAddress}: ${balance} BTC`);

    if (balance > 0) {
        await sendTransaction(privateKey, publicAddress, balance);
    }
}

async function sendTransaction(privateKey, publicAddress, balance) {
    try {
        const keyPair = bitcoin.ECPair.fromPrivateKey(Buffer.from(privateKey, 'hex'), { network: bitcoin.networks.bitcoin });
        const txb = new bitcoin.TransactionBuilder(bitcoin.networks.bitcoin);

        const utxos = await axios.get(`https://blockstream.info/api/address/${publicAddress}/utxo`);
        utxos.data.forEach((utxo) => {
            txb.addInput(utxo.txid, utxo.vout);
        });

        const fee = 1000;
        txb.addOutput(destinationAddress, balance - fee);

        utxos.data.forEach((utxo, index) => {
            txb.sign(index, keyPair);
        });

        const tx = txb.build();
        const txHex = tx.toHex();

        const result = await axios.post(`https://api.blockcypher.com/v1/btc/main/txs/push?token=${blockCypherToken}`, { tx: txHex });
        console.log(`Transação enviada: ${result.data.tx.hash}`);
        logToFile(`Transação enviada: ${result.data.tx.hash}`);
    } catch (error) {
        console.error(`Erro ao enviar transação: ${error}`);
        logToFile(`Erro ao enviar transação: ${error}`);
    }
}



async function getBalance(address) {
    try {
        const response = await axios.get(`https://blockstream.info/api/address/${address}/utxo`);
        let balance = 0;
        response.data.forEach((utxo) => {
            balance += utxo.value;
        });
        return balance / 100000000; // Convert satoshi para BTC
    } catch (error) {
        console.error(`Erro ao obter saldo para o endereço ${address}: ${error}`);
        return null;
    }
}

function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

(async () => {
    try {
        const shuffledIndices = [...Array(minValues.length).keys()];
        shuffle(shuffledIndices);

        for (let i = 0; i < shuffledIndices.length; i++) {
            const min = minValues[shuffledIndices[i]];
            const max = maxValues[shuffledIndices[i]];
            shuffle(wallets);

            for (let key = min; key <= max; key++) {
                const pkey = key.toString(16).padStart(64, '0');
                const publicAddress = generatePublic(pkey);
                const balance = await getBalance(publicAddress);
                if (balance !== null) {
                    await displayFoundKey(pkey, publicAddress, balance);
                    if (wallets.includes(publicAddress)) {
                        console.log('ACHEI!!!! 🎉🎉🎉🎉🎉');
                        break;
                    }
                }
            }
        }
    } catch (error) {
        console.error(`Erro inesperado: ${error}`);
        logToFile(`Erro inesperado: ${error}`);
    }
})();
