/* Libraries */
const EventEmitter = require('events');
const SerialPort = require('serialport');
const IPP = require('../lib/insteon-packet-parser');

/* PLM Class */
module.exports = class PLM extends EventEmitter{
  constructor(portPath){
    /* Constructing super class */
    super();

    /* Internal Variables */
    this._commandQueue = [];
    this._commandInFlight = false;
    this.powerLincLinks = [];
    this.deviceLinks = [];

    /* Opening serial port */
    this.port = new SerialPort(portPath, {
      lock: false,
      baudRate: 19200,
      dataBits: 8,
      stopBits: 1,
      parity: 'none'
    });

    /* Creating new parser */
    this.parser = new IPP();

    /* Porting serial port to parser */
    this.port.pipe(this.parser);

    /* Waiting for serial port to open */
    this.port.on('open', () => {
      this.emit('ready');
    });

    /* On Packet */
    this.parser.on('data', (packet)=>{
      /* Checking if packet is command echo */
      if(packet.id == 80){
        this._gotCommandEcho(packet);
      }

      this.emit('packet', packet);
    });
  }

  /* Modem Info */
  info(){
    /* Allocating command buffer */
    const commandBuffer = Buffer.alloc(2);

    /* Creating command */
    commandBuffer.writeUInt8(0x02, 0); //PLM Command
    commandBuffer.writeUInt8(0x60, 1); //Get IM Configuration

    /* Sending command */
    this.execute(commandBuffer);
  }
  config(){
    /* Allocating command buffer */
    const commandBuffer = Buffer.alloc(2);

    /* Creating command */
    commandBuffer.writeUInt8(0x02, 0); //PLM Command
    commandBuffer.writeUInt8(0x73, 1); //Get IM Configuration

    /* Sending command */
    this.execute(commandBuffer);
  }

  /* Modem LED */
  get led(){
    return this._led;
  }
  set led(state){
    /* Allocating command buffer */
    const commandBuffer = Buffer.alloc(2);
    
    /* State */
    const stateByte = state ? 0x6D:0x6E;

    /* Creating command */
    commandBuffer.writeUInt8(0x02, 0);      //PLM Command
    commandBuffer.writeUInt8(stateByte, 1); //Set LED state byte

    /* Sending command */
    this.execute(commandBuffer);
  }

  syncLinks(callback){

    /* Handling Responses */
    this.port.on('packet', (packet)=>{
      /* Checking to make sure this is the packet we're looking for */
      if(packet.type == 'ALL-Link Record Response'){
        //console.log(packet);

        /* Saving Device Link */
        this.deviceLinks[packet.allLinkGroup] = this.deviceLinks[packet.allLinkGroup] || [];

        const link = {
          type: packet.recordType,
          device: packet.from.map((id)=> id.toString(16)),
          data: packet.linkData
        };

        //console.log(link);

        // console.log(packet);

        this.deviceLinks[packet.allLinkGroup].push(link);
      }
      if(packet.type == 'Get First ALL-Link Record' || packet.type == 'Get Next ALL-Link Record'){
        /* If there is another record avaliable */
        if(packet.success){
          /* Getting next link */
          this.getNextLink();
        }
        else{
          callback();
        }
      }
    });

    this.getFirstLink();
  }
  getFirstLink(){
    /* Allocating command buffer */
    const commandBuffer = Buffer.alloc(2);

    /* Creating command */
    commandBuffer.writeUInt8(0x02, 0); //PLM Command
    commandBuffer.writeUInt8(0x69, 1); //Get IM Configuration

    /* Sending command */
    this.execute(commandBuffer);
  }
  getNextLink(){
    /* Allocating command buffer */
    const commandBuffer = Buffer.alloc(2);

    /* Creating command */
    commandBuffer.writeUInt8(0x02, 0); //PLM Command
    commandBuffer.writeUInt8(0x6A, 1); //Get IM Configuration

    /* Sending command */
    this.execute(commandBuffer);
  }

  /* Modem Control */
  setConfig(autoLinking, monitorMode, autoLED, deadman){
    /* Configuration byte */
    let flagByte = 0x00;
    
    if(!autoLinking) flagByte |= 0x80;  //1000 0000
    if(!monitorMode) flagByte |= 0x40;  //0100 0000
    if(!autoLED)     flagByte |= 0x20;  //0010 0000
    if(!deadman)     flagByte |= 0x10;  //0001 0000

    /* Allocating command buffer */
    const commandBuffer = Buffer.alloc(3);

    /* Creating command */
    commandBuffer.writeUInt8(0x02, 0);     //PLM Command
    commandBuffer.writeUInt8(0x6B, 1);     //Set IM Configuration
    commandBuffer.writeUInt8(flagByte, 2); //IM Configuration Flags

    /* Sending command */
    this.execute(commandBuffer);
  }
  sleep(){
    /* Allocating command buffer */
    const commandBuffer = Buffer.alloc(4);
  
    /* Creating command */
    commandBuffer.writeUInt8(0x02, 0); //PLM Command
    commandBuffer.writeUInt8(0x72, 1); //RF Sleep Byte
    commandBuffer.writeUInt8(0x00, 2); //Command 1 (Not Used)
    commandBuffer.writeUInt8(0x00, 3); //Command 2 (Not Used)

    /* Sending command */
    this.execute(commandBuffer);
  }
  wake(){
    /* Allocating command buffer */
    const commandBuffer = Buffer.alloc(1);

    /* Creating command */
    commandBuffer.writeUInt8(0x02, 0); //PLM Command

    /* Sending command */
    this.execute(commandBuffer);
  }
  close(){
    this.port.close();
  }

  /* Device Info */
  status(deviceID){
    /* Parsing out device ID */
    const id = deviceID.split('.').map((byte)=> parseInt(byte, 16));

    /* Allocating command buffer */
    const commandBuffer = Buffer.alloc(8);

    /* Creating command */
    commandBuffer.writeUInt8(0x02, 0); //PLM Command
    commandBuffer.writeUInt8(0x62, 1); //Standard Length Message
    commandBuffer.writeUInt8(id[0], 2); //Device High Address Byte
    commandBuffer.writeUInt8(id[1], 3); //Device Middle Address Byte
    commandBuffer.writeUInt8(id[2], 4); //Device Low Address Byte
    commandBuffer.writeUInt8(0x07, 5); //Message Flag Byte
    commandBuffer.writeUInt8(0x19, 6); //Command Byte 1
    commandBuffer.writeUInt8(0x00, 7); //Command Byte 2

    /* Sending command */
    this.execute(commandBuffer);
  }
  /* Device Control */
  switch(deviceID, state, fast=false){
    /* Parsing out device ID */
    const regex = /([A-F0-9]{2}).([A-F0-9]{2}).([A-F0-9]{2}):?(\d)?/gi;

    /* Searching deviceID for parts */
    const data = regex.exec(deviceID);

    /* Validating data */
    if(!(data.length === 4 || data.length === 5)){
      throw 'Device ID Invalid';
    }
    if(typeof state !== 'boolean' || typeof state !== 'number'){
      new TypeError('State is not a boolean or number'); 
    }
    if(typeof state === 'number' && (state < 0 || state > 100)){
      throw new RangeError('State Out of Range');
    }

    /* Determing state to set */
    if(typeof state === 'boolean'){
      state = state ? 0xFF : 0x00;
    }
    else if(typeof state === 'number'){
      /* Extending range from 0-100 to 0-255 */
      state = Math.floor(state * 2.55);
    }

    /* Determing how fast/what command to use */
    let command =  0x11;
    if(state > 0){
      command =  fast ? 0x12:0x11; 
    }
    else{
      command =  fast ? 0x14:0x13; 
    }
    
    /* Pulling address out and making new array */
    const address = data.slice(1,5);
    const commandBuffer = this._createSwitchCommand(address, command, state);

    /* Sending command */
    this.execute(commandBuffer);
  }

  async execute(commandBuffer){
    this._commandQueue.push(commandBuffer);

    this._flush();
  }

  /* Internal Commands */
  _createSwitchCommand(address, command, state){
    /* Packet buffer */
    let commandBuffer;

    /* Standard address: standard packet */
    if(address.length === 3){
      /* Allocating command buffer */
      commandBuffer = Buffer.alloc(8);
      
      /* Creating command */
      commandBuffer.writeUInt8(0x02, 0);                 //PLM Command
      commandBuffer.writeUInt8(0x62, 1);                 //Standard Length Message
      commandBuffer.writeUInt8(parseInt(address[0],16), 2); //Device High Address Byte
      commandBuffer.writeUInt8(parseInt(address[1],16), 3); //Device Middle Address Byte
      commandBuffer.writeUInt8(parseInt(address[2],16), 4); //Device Low Address Byte
      commandBuffer.writeUInt8(0x0F, 5);                 //Message Flag Byte
      commandBuffer.writeUInt8(command, 6);              //Command Byte 1
      commandBuffer.writeUInt8(state,7);                 //Command Byte 2
    }
    /* Extended address: extended packet */
    else if(address.length === 4){
      /* Allocating command buffer */
      commandBuffer = Buffer.alloc(22);
      
      /* Creating command */
      commandBuffer.writeUInt8(0x02, 0);                 //PLM Command
      commandBuffer.writeUInt8(0x62, 1);                 //Extended Length Message
      commandBuffer.writeUInt8(parseInt(address[0],16), 2); //Device High Address Byte
      commandBuffer.writeUInt8(parseInt(address[1],16), 3); //Device Middle Address Byte
      commandBuffer.writeUInt8(parseInt(address[2],16), 4); //Device Low Address Byte
      commandBuffer.writeUInt8(0x1F, 5);                 //Message Flag Byte
      commandBuffer.writeUInt8(command, 6);              //Command Byte 1
      commandBuffer.writeUInt8(state,7);                 //State Byte
      commandBuffer.writeUInt8(parseInt(address[3]), 8); //Modifier Byte
      commandBuffer.writeUInt8(0x00, 9);                 //User Data 2
      commandBuffer.writeUInt8(0x00, 10);                //User Data 3
      commandBuffer.writeUInt8(0x00, 11);                //User Data 4
      commandBuffer.writeUInt8(0x00, 12);                //User Data 5
      commandBuffer.writeUInt8(0x00, 13);                //User Data 6
      commandBuffer.writeUInt8(0x00, 14);                //User Data 7
      commandBuffer.writeUInt8(0x00, 15);                //User Data 8
      commandBuffer.writeUInt8(0x00, 16);                //User Data 9
      commandBuffer.writeUInt8(0x00, 17);                //User Data 10
      commandBuffer.writeUInt8(0x00, 18);                //User Data 11
      commandBuffer.writeUInt8(0x00, 19);                //User Data 12
      commandBuffer.writeUInt8(0x00, 20);                //User Data 13

      /* Calulating checksum */
      let checksum = 0x00;
      for(let i = 6; i <= 20; i++){
        checksum += commandBuffer.readUInt8(i);
      }

      /* Compliment checksum, adding one, then taking last two bytes */
      checksum = (((~(checksum)) + 1) & 0xFF);

      /* Writing checksum to command */
      commandBuffer.writeUInt8(checksum, 21);
    }

    /* Return completed packet buffer */
    return commandBuffer;
  }
  _gotCommandEcho(){
    /* Checking we are actually waiting for a packet echo */
    if(this._commandInFlight){
      /* Marking we have an echo */
      this._commandInFlight = false;

      setTimeout(this._flush.bind(this), 150);
    }
  }
  async _flush(){
    /* Checking we have a request and a command is not in progress */
    if(this._commandQueue[0] && !this._commandInFlight){

      /* Removing command from queue */
      const nextRequest = this._commandQueue.shift();

      /* Marking command in flight */
      this._commandInFlight = true;

      try{
        /* Writing command to modem */
        await this.port.write(nextRequest);
      }
      catch(error){
        console.error(error);
      }
    }
  }
};
