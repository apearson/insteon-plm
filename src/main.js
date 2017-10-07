/* Libraries */
const EventEmitter = require('events');
const SerialPort = require('serialport');
const IPP = require('../lib/insteon-packet-parser');

/* Request Handlers */
const handlers = require('./handlers.js');

/* PLM Class */
module.exports = class PLM extends EventEmitter{
  constructor(portPath){
    /* Constructing super class */
    super();

    /* Internal Variables */
    this._requestQueue = [];
    this._requestInFlight = false;
    this._allLinks = [];
    this._flushTimeout = 250;
    this._config = null;

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
    this.port.on('open', async () => {
      /* Emitting connected and syncing */
      this.emit('connected');

      /* Inital Sync of info */
      this._info   = await this.syncInfo();
      this._config = await this.syncConfig();
      //await this.syncAllLink();

      /* Emitting ready */
      this.emit('ready');
    });

    /* On Packet */
    this.parser.on('data', (packet)=>{
      /* Checking if we need to do anything special with packet */
      if(this._requestInFlight){
        this._handleResponse(packet);
      }

      /* Emitting packet for others to use */
      this.emit('packet', packet);
    });
  }

  /* Modem Info */
  syncInfo(){
    return new Promise((resolve, reject)=>{
      /* Allocating command buffer */
      const commandBuffer = Buffer.alloc(2);

      /* Creating command */
      commandBuffer.writeUInt8(0x02, 0);
      commandBuffer.writeUInt8(0x60, 1);

      /* Creating Request */
      const request = {
        resolve: resolve,
        reject: reject,
        type: 0x60,
        command: commandBuffer,
      };

      /* Sending command */
      this.execute(request);
    });
  }
  syncConfig(){
    return new Promise((resolve, reject)=>{
      /* Allocating command buffer */
      const commandBuffer = Buffer.alloc(2);

      /* Creating command */
      commandBuffer.writeUInt8(0x02, 0);
      commandBuffer.writeUInt8(0x73, 1);

      /* Creating Request */
      const request = {
        resolve: resolve,
        reject: reject,
        type: 0x73,
        command: commandBuffer,
      };

      /* Sending command */
      this.execute(request);
    });
  }
  syncAllLink(){
    return new Promise(async (resolve, reject)=>{
      /* Creating an array of 255 groups filled with empty arrays */
      let groups = [...Array(255).keys()].map(i => Array(0));

      /* Getting first record */
      let record = await this.getFirstAllLinkRecord();

      /* Checking if first record exists */
      if(record !== false){
        groups[record.group].push(record);        
      }

      /* While there are more records get them */
      while(record !== false){
        record = await this.getNextAllLinkRecord();

        /* Checking if retrieved record exists */
        if(record !== false){
          groups[record.group].push(record);          
        }
      }

      /* Saving all link database */
      this._allLinks = groups;

      resolve(this._allLinks);
    });
  }

  /* Modem Config */
  get info(){
    return this._info;
  }
  get config(){
    return this._config;
  }
  get allLinks(){
    return this._allLinks;
  }

  /* Modem LED */
  get led(){
    return this._led;
  }
  setLed(state){
    return new Promise((resolve, reject)=>{
      /* Allocating command buffer */
      const commandBuffer = Buffer.alloc(2);

      /* Determining command */
      let command = state ? 0x6D:0x6E;

      /* Creating command */
      commandBuffer.writeUInt8(0x02, 0);
      commandBuffer.writeUInt8(command, 1);

      /* Creating Request */
      const request = {
        resolve: resolve,
        reject: reject,
        type: command,
        command: commandBuffer,
      };

      /* Sending command */
      this.execute(request);
    });
  }

  /* Modem Control */
  setConfig(autoLinking, monitorMode, autoLED, deadman){
    return new Promise((resolve, reject)=>{
      /* Configuration byte */
      let flagByte = 0x00;
      
      if(!autoLinking) flagByte |= 0x80;  //1000 0000
      if(monitorMode)  flagByte |= 0x40;  //0100 0000
      if(!autoLED)     flagByte |= 0x20;  //0010 0000
      if(!deadman)     flagByte |= 0x10;  //0001 0000

      /* Allocating command buffer */
      const commandBuffer = Buffer.alloc(3);

      /* Creating command */
      commandBuffer.writeUInt8(0x02, 0);     //PLM Command
      commandBuffer.writeUInt8(0x6B, 1);     //Set IM Configuration
      commandBuffer.writeUInt8(flagByte, 2); //IM Configuration Flags

      /* Creating Request */
      const request = {
        resolve: resolve,
        reject: reject,
        type: 0x6B,
        command: commandBuffer,
      };

      /* Sending command */
      this.execute(request);
    });
  }
  sleep(){
    return new Promise((resolve, reject)=>{
      /* Allocating command buffer */
      const commandBuffer = Buffer.alloc(4);
    
      /* Creating command */
      commandBuffer.writeUInt8(0x02, 0); //PLM Command
      commandBuffer.writeUInt8(0x72, 1); //RF Sleep Byte
      commandBuffer.writeUInt8(0x00, 2); //Command 1 (Not Used)
      commandBuffer.writeUInt8(0x00, 3); //Command 2 (Not Used)

      /* Creating Request */
      const request = {
        resolve: resolve,
        reject: reject,
        type: 0x72,
        command: commandBuffer,
      };

      /* Sending command */
      this.execute(request);
    });
  }
  wake(){
    return new Promise((resolve, reject)=>{
      /* Allocating command buffer */
      const commandBuffer = Buffer.alloc(1);
    
      /* Creating command */
      commandBuffer.writeUInt8(0x02, 0); //PLM Command

      /* Creating Request */
      const request = {
        resolve: null,
        reject: reject,
        type: 0x72,
        command: commandBuffer,
      };

      /* Responding after wake up */
      setTimeout(()=>{
        this._requestInFlight = false;

        resolve(true);
      }, 40);

      /* Sending command */
      this.execute(request);
    });
  }
  close(){
    return this.port.close();
  }

  /* All Link Command */
  getFirstAllLinkRecord(){
    return new Promise((resolve, reject)=>{
      /* Allocating command buffer */
      const commandBuffer = Buffer.alloc(2);

      /* Creating command */
      commandBuffer.writeUInt8(0x02, 0);
      commandBuffer.writeUInt8(0x69, 1);

      /* Creating Request */
      const request = {
        resolve: resolve,
        reject: reject,
        type: 0x57,
        command: commandBuffer,
      };

      /* Sending command */
      this.execute(request);
    });
  }
  getNextAllLinkRecord(){
    return new Promise((resolve, reject)=>{
      /* Allocating command buffer */
      const commandBuffer = Buffer.alloc(2);

      /* Creating command */
      commandBuffer.writeUInt8(0x02, 0);
      commandBuffer.writeUInt8(0x6A, 1);

      /* Creating Request */
      const request = {
        resolve: resolve,
        reject: reject,
        type: 0x57,
        command: commandBuffer,
      };

      /* Sending command */
      this.execute(request);
    });
  }

  /* Device Info */
  status(deviceID){
    return new Promise((resolve, reject)=>{      
      /* Parsing out device ID */
      const id = deviceID.split('.').map((byte)=> parseInt(byte, 16));

      /* Allocating command buffer */
      const commandBuffer = Buffer.alloc(8);

      /* Creating command */
      commandBuffer.writeUInt8(0x02, 0);  //PLM Command
      commandBuffer.writeUInt8(0x62, 1);  //Standard Length Message
      commandBuffer.writeUInt8(id[0], 2); //Device High Address Byte
      commandBuffer.writeUInt8(id[1], 3); //Device Middle Address Byte
      commandBuffer.writeUInt8(id[2], 4); //Device Low Address Byte
      commandBuffer.writeUInt8(0x07, 5);  //Message Flag Byte
      commandBuffer.writeUInt8(0x19, 6);  //Command Byte 1
      commandBuffer.writeUInt8(0x01, 7);  //Command Byte 2

      /* Creating Request */
      const request = {
        resolve: resolve,
        reject: reject,
        type: 0x62,
        command: commandBuffer,
      };

      /* Sending command */
      this.execute(request);
    });
  }
  /* Device Control */
  switch(deviceID, state, fast=false){
    return new Promise((resolve, reject)=>{
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

      /* Creating Request */
      const request = {
        resolve: resolve,
        reject: reject,
        type: command,
        command: commandBuffer,
      };

      /* Sending command */
      this.execute(request);
    });
  }

  async execute(request){
    this._requestQueue.push(request);
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
  async _flush(){
    /* Checking we have a request and a command is not in progress */
    if(this._requestQueue[0] && !this._requestInFlight){
      /* Marking command in flight */
      this._requestInFlight = true;

      try{
        /* Writing command to modem */
        await this.port.write(this._requestQueue[0].command);
      }
      catch(error){
        console.error(error);
      }
    }
  }

  /* Response Functions */
  _handleResponse(packet){
    /* Determining Request and Response */
    let [request, response] = handlers[packet.id](this._requestQueue, packet);

    /* Finishing request */
    if(request != null){
      this._finishRequest(request, response);
    }
  }
  _finishRequest(request, response){
    /* Resolving request */
    request.resolve(response);

    /* Flushing next command after cool down */
    setTimeout(()=>{
      /* Marking we have an echo */
      this._requestInFlight = false;

      /* Flushing next command */
      this._flush();
    }, this._flushTimeout);
  }

};
