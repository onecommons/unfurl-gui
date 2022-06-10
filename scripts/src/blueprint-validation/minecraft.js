#!/usr/bin/env node
const expect = require('expect')
const net = require('net')

// Written by Sindre Sorhus, used under MIT license
// https://github.com/sindresorhus/is-port-reachable
async function isPortReachable(port, {host, timeout = 1000} = {}) {
	if (typeof host !== 'string') {
		throw new TypeError('Specify a `host`');
	}

	const promise = new Promise(((resolve, reject) => {
		const socket = new net.Socket();

		const onError = () => {
			socket.destroy();
			reject();
		};

		socket.setTimeout(timeout);
		socket.once('error', onError);
		socket.once('timeout', onError);

		socket.connect(port, host, () => {
			socket.end();
			resolve();
		});
	}));

	try {
		await promise;
		return true;
	} catch {
		return false;
	}
}


async function main({host, port}){
  expect(await (isPortReachable(port, {host}))).toBe(true)
  console.log('Test passed')
}

async function tryMain() {
  const args = require('minimist')(process.argv.slice(2))
  try {
    await main({
      ...args
    })
  } catch(e) {
    if(e.code) {
      console.error(e.code)
      //console.error(e)
      process.exit(1)
    } else {
      console.log(e.message)
      process.exit(1)
    }
  }
}
tryMain()

