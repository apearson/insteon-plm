/* Packet Handling Classes */
module.exports = {
  /** IM to Host **/
  /* Standard Message Received */
  0x50: async (requestQueue, deviceQueues, packet)=> new Promise((resolve, reject)=>{
    /* Converting from field to string for device queuing */
    const fromBuffer = Buffer.from(packet.from);
    const deviceIndex = fromBuffer.readUIntBE(0, 3);

    /* Checking if device queue contains request */
    if(deviceQueues[deviceIndex] != null && deviceQueues[deviceIndex].queue[0].type === 0x62){
      /* Resolving request */
      deviceQueues[deviceIndex].queue[0].resolve(packet);

      /* Waiting for device cool before release inFlight */
      setTimeout(()=>{
        deviceQueues[deviceIndex].queue.shift();
        deviceQueues[deviceIndex].inFlight = false;

        /* Returning that the request does not need finishing */
        resolve(false);
      }, 250);
    }
  }),
  /* Extended Message Received */
  0x51: async (requestQueue, deviceQueues, packet)=> new Promise((resolve, reject)=>{
    /* Converting from field to string for device queuing */
    const fromBuffer = Buffer.from(packet.from);
    const deviceIndex = fromBuffer.readUIntBE(0, 3);

    /* Checking if device queue contains request */
    if(deviceQueues[deviceIndex] != null && deviceQueues[deviceIndex].queue[0].type === 0x62){
      /* Resolving request */
      deviceQueues[deviceIndex].queue[0].resolve(packet);

      /* Waiting for device cool before release inFlight */
      setTimeout(()=>{
        deviceQueues[deviceIndex].queue.shift();
        deviceQueues[deviceIndex].inFlight = false;

        /* Returning that the request does not need finishing */
        resolve(false);
      }, 250);
    }
  }),
  /* ALL-Link Record Response */
  0x57: async (requestQueue, deviceQueues, packet)=>{
    if(deviceQueues[0].queue[0].type === 0x57){
      const request = deviceQueues[0].queue.shift();
      deviceQueues[0].inFlight = false;

      /* Resolving request */
      request.resolve({
        type: packet.recordType,
        group: packet.allLinkGroup,
        from: packet.from,
        linkData: packet.linkData
      });
    }

    /* Returning that the request does not need finishing */
    return false;
  },

  /** Host to IM **/
  /* Get IM Info */
  0x60: async (requestQueue, deviceQueues, packet)=>{
    /* Checking request queue for correct packet */
    if(requestQueue[0].type === 0x60){
      const request = requestQueue.shift();

      /* Resolving request */
      request.resolve({
        id: packet.ID,
        devcat: packet.devcat,
        subcat: packet.subcat,
        firmware: packet.firmware,
      });
      
      /* Returning that the request was handled */
      return true;
    }
    else{
      /* Returning that the request was not handled */
      return false;
    }
  },
  /* Send Standard or Extended Message */
  0x62: async (requestQueue, deviceQueues, packet)=>{
    /* Checking request queue for correct packet */
    if(requestQueue[0].type === 0x62){
      const request = requestQueue.shift();
      
      /* Returning that the request was handled */
      return true;
    }
    else{
      /* Returning that the request was not handled */
      return false;
    }
  },
  /* Start ALL-Linking */
  0x64: async (requestQueue, deviceQueues, packet)=>{
    if(requestQueue[0].type === 0x64){
      const request = requestQueue.shift();

      /* Resolving request */
      request.resolve(packet.success);
      
      /* Returning that the request was handled */
      return true;
    }
    else{
      /* Returning that the request was not handled */
      return false;
    }
  },
  /* Cancel ALL-Linking */
  0x65: async (requestQueue, deviceQueues, packet)=>{
    if(requestQueue[0].type === 0x65){
      const request = requestQueue.shift();

      /* Resolving request */
      request.resolve(packet.success);
      
      /* Returning that the request was handled */
      return true;
    }
    else{
      /* Returning that the request was not handled */
      return false;
    }
  },
  0x66: async (requestQueue, deviceQueues, packet)=>{
    if(requestQueue[0].type === 0x65){
      const request = requestQueue.shift();

      /* Resolving request */
      request.resolve(packet);
      
      /* Returning that the request was handled */
      return true;
    }
    else{
      /* Returning that the request was not handled */
      return false;
    }
  },
  /* Get First ALL-Link Record */
  0x69: async (requestQueue, deviceQueues, packet)=>{
    if(requestQueue[0].type === 0x57){
      const request = requestQueue.shift();

      /* If request did not ack successfully */
      if(!packet.success){
        request.resolve(false);
      }

      /* Returning that the request was handled */
      return true;
    }
    else{
      /* Returning that the request was not handled */
      return false;
    }
  },
  /* Get Next ALL-Link Record */
  0x6A: async (requestQueue, deviceQueues, packet)=>{
    if(requestQueue[0].type === 0x57){
      const request = requestQueue.shift();

      /* If request did not ack successfully */
      if(!packet.success){
        request.resolve(false);
      }

      /* Returning that the request was handled */
      return true;
    }
    else{
      /* Returning that the request was not handled */
      return false;
    }
  },
  /* Set IM Configuration */
  0x6B: async (requestQueue, deviceQueues, packet)=>{
    /* Checking request queue for correct packet */
    if(requestQueue[0].type === 0x6B){
      const request = requestQueue.shift();
      
      /* Resolving request */
      request.resolve({
        autoLinking: packet.autoLinking,
        monitorMode: packet.monitorMode,
        autoLED: packet.autoLED,
        deadman: packet.deadman
      });

      /* Returning that the request was handled */
      return true;
    }
    else{
      /* Returning that the request was not handled */
      return false;
    }
  },
  /* LED On */
  0x6D: async (requestQueue, deviceQueues, packet)=>{
    /* Checking request queue for correct packet */
    if(requestQueue[0].type === 0x6D){
      const request = requestQueue.shift();
      
      /* Resolving request */
      request.resolve(packet.success);
      
      /* Returning that the request was handled */
      return true;
    }
    else{
      /* Returning that the request was not handled */
      return false;
    }
  },
  /* LED Off */
  0x6E: async (requestQueue, deviceQueues, packet)=>{
    /* Checking request queue for correct packet */
    if(requestQueue[0].type === 0x6E){
      const request = requestQueue.shift();
      
      /* Resolving request */
      request.resolve(packet.success);
      
      /* Returning that the request was handled */
      return true;
    }
    else{
      /* Returning that the request was not handled */
      return false;
    }
  },
  /* RF Sleep */
  0x72: async (requestQueue, deviceQueues, packet)=>{
    /* Checking request queue for correct packet */
    if(requestQueue[0].type === 0x72){
      const request = requestQueue.shift();

      /* Resolving request */
      request.resolve(packet.success);

      /* Returning that the request was handled */
      return true;
    }
    else{
      /* Returning that the request was not handled */
      return false;
    }
  },
  /* Get IM Configuration */
  0x73: async (requestQueue, deviceQueues, packet)=>{
    /* Checking request queue for correct packet */
    if(requestQueue[0].type === 0x73){
      const request = requestQueue.shift();

      /* Resolving request */
      request.resolve({
        autoLinking: packet.autoLinking,
        monitorMode: packet.monitorMode,
        autoLED: packet.autoLED,
        deadman: packet.deadman
      });

      /* Returning that the request was handled */
      return true;
    }
    else{
      /* Returning that the request was not handled */
      return false;
    }
  },
};