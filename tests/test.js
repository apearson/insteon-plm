/* Libaries */
const PLM = require('../src/main.js');

/* Setup */
const modem = new PLM('/dev/tty.usbserial-A60336ZZ');
const device = '41.41.E7';
const device2 = '42.AA.78';

/* Waiting on modem ready */
modem.on('ready', ()=>{
  console.info('Modem Ready');
  // modem.info();
//  modem.config();
  modem.switch(device2, true, true);
  modem.switch(device2, false, true);
  
  modem.switch(device2, true, true);
  modem.switch(device2, false, true);

  modem.switch(device2, true, true);
  modem.switch(device2, false, true);

  //setTimeout(()=> modem.switchOn(device), 500);
  // setTimeout(()=> {modem.getLightStatus(device); }, 3000);

  // modem.syncLinks(()=>{
  //   console.log(JSON.stringify(modem.deviceLinks));
  // })

  setTimeout(() => modem.close(), 5000);
});

/* Printing incoming packets */
modem.on('packet', (data)=>{
  console.info(data);
});
