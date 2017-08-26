const SerialPort = require('serialport');
const IPP = require('insteon-packet-parser');

/* Open serial port */
const port = new SerialPort('/dev/tty.usbserial-A60336ZZ', {
  baudRate: 19200,
  dataBits: 8,
  stopBits: 1,
  parity: 'none'
});

/* Creating new parser */
const parser = new IPP();

/* Porting serial port to parser */
port.pipe(parser);

/* On data */
parser.on('data', (data)=> console.info(data));

/* Result
  { 
    id: 0x73,
    type: 'Get IM Configuration',
    autoLinking: true,
    monitorMode: true,
    autoLED: true,
    deadman: true,
    success: true 
  } 
*/

/* On serial port opened send command */
port.on('open', () => {
  const buf = Buffer.alloc(2);
        buf.writeUInt8(0x02, 0);
        buf.writeUInt8(0x73,1);
        
  port.write(buf, (error) => {
    if(error){
      console.error(`Error: ${error}`);
    }
  });
});