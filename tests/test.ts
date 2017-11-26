/* Libaries */
import {PLM, OutletLinc} from '../src/main';

/* Setup */
const modem = new PLM('/dev/tty.usbserial-A60336ZZ');

const devices = {
  sunroom: '42.01.FC:2',
  kitchenSink: '41.D4.54',
  entry: '39.6F.31',
  plm: '31.15.C9',
  remote: '3E.F7.33',
  oven: '3E.C6.FF',
  kitchenOverhead: '41.41.E7',
  livingroom: '42.01.17:2',
  kitchenTable: '42.AA.78',
  bedroom: '01.64.E5'
};

modem.on('connected', ()=> console.info('Modem Connected'));

/* Waiting on modem ready */
modem.on('ready', async ()=>{
  console.info('Modem Ready');
  // console.log(modem.info);
  // console.log(modem.config);

  // console.log('Got all links', modem.links.length);

  const lamp = new OutletLinc([66, 1, 252], modem);

  await lamp.switch(2, true);
});

process.on('unhandledRejection', (reason, p) => {
  console.log('Unhandled Rejection at: Promise:', reason);
});

/* Printing incoming packets */
// modem.on('packet', (data)=>{
//   console.info(data);
// });
