#!/usr/bin/env node
process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0

const tls = require('tls')
const fs = require('fs')
const http = require('http')
const path = require('path')

const remoteServer = process.argv[2]
const remotePort = process.argv[3]
const localPort = process.argv[4]
const localServer = process.argv[5]

if (!localPort || !remoteServer || !remotePort) {
	console.log("\tUsage: \n\t"+path.basename(process.argv[0])+" "+path.basename(process.argv[1])+" <local port> <remote server> <remote port> [<local interface = 0.0.0.0>]")
	process.exit()
}

const queue = {}

const socket = tls.connect({
	host: remoteServer,
	port: remotePort,
	checkServerIdentity: () => null
}, () => {
  console.log('client connected')
})

socket.setEncoding('utf8')

socket.on('data', data => {
	try {
		data = JSON.parse(data)
		if (data.id && queue[data.id]) {
			queue[data.id](data)
			delete queue[data.id]
		}
	} catch (e) {
		console.log(e)
	}
})

socket.on('end', () => {
  console.log('server ended connection');
});

const httpServer = http.createServer((req, res) => {
	let data = []

	req.on('data', chunk => data.push(chunk))

	req.on('end', () => {
		if (req.method !== 'POST') {
			res.write("POST requests only")
			return res.end()
		}
		try {
			data = JSON.parse(data)
		} catch (e) {
			res.write("Malformed request")
			return res.end()
		}

		let request_id = data.id || Math.random().toString(26).slice(2)
		data.id = request_id

		socket.write(JSON.stringify(data) + "\n")

		queue[request_id] = response => {
			res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' })
			res.write(JSON.stringify(response))
			res.end()
		}
	})
})

httpServer.listen(localPort, localServer)