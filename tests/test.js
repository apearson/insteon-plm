const PLM = require('../src/main.js');

const modem = new PLM('/dev/ttyUSB0');
const device = '42.01.FC:2';


modem.on('ready', ()=>{
  console.log('Modem Ready');

  // modem.setConfig(true, true, false, true);

  // setTimeout(()=> modem.led = true, 1000);
  // setTimeout(()=> modem.led = false, 1500);
  // setTimeout(()=> modem.setConfig(true, true, true, true), 2000);

  modem.switch(device, false);
  // setTimeout(()=> modem.switch(device, 0), 1000);
  // setTimeout(()=> modem.switch(device, 100), 2000);
  // setTimeout(()=> modem.switch(device, 0), 3000);

  // modem.syncLinks(()=>{
  //   console.log(JSON.stringify(modem.deviceLinks));
  // })

  modem.close();

});

modem.on('packet', (data)=>{
  console.log(data);
});
