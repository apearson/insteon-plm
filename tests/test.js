/* Libaries */
const PLM = require('../src/main.js');

/* Setup */
const modem = new PLM('/dev/ttyUSB0');
const device = '42.01.FC:2';

/* Waiting on modem ready */
modem.on('ready', ()=>{
  console.info('Modem Ready');
  // console.info(modem.config);
  // modem.setConfig(true, true, false, true);
  // setTimeout(()=> modem.led = true, 1000);
  // setTimeout(()=> modem.led = false, 1500);
  // setTimeout(()=> modem.setConfig(true, true, true, true), 2000);

  modem.switch(device, true);
  //setTimeout(()=> modem.switch(device, 0), 1000);
  // setTimeout(()=> modem.switch(device, true), 1000);
  // setTimeout(()=> modem.switch(device, false), 2000);

  // modem.syncLinks(()=>{
  //   console.log(JSON.stringify(modem.deviceLinks));
  // })

  setTimeout(() => modem.close(), 3000);

});

/* Printing incoming packets */
modem.on('packet', (data)=>{
  console.info(data);
});
