/* Packet Handling Classes */
module.exports = {
  0x50: (requestQueue, packet)=>{
    /* Checking request queue for correct packet */
    if([0x11, 0x12, 0x13, 0x14].includes(requestQueue[0].type)){
      const request = requestQueue.shift();

      return [request, request.meaning];
    }
    else if(requestQueue[0].type === 0x62){
      const request = requestQueue.shift();

      return [request, packet.cmd2];
    }
  },
  0x51: (requestQueue, packet)=>{
    /* Checking request queue for correct packet */
    if([0x11, 0x12, 0x13, 0x14].includes(requestQueue[0].type)){
      const request = requestQueue.shift();
      
      return [request, request.meaning];
    }
  },
  0x57: (requestQueue, packet)=>{
    if(requestQueue[0].type === 0x57){
      const request = requestQueue.shift();

      return [request, {
        type: packet.recordType,
        group: packet.allLinkGroup,
        from: packet.from,
        linkData: packet.linkData
      }];
    }
  },
  0x60: (requestQueue, packet)=>{
    /* Checking request queue for correct packet */
    if(requestQueue[0].type === 0x60){
      const request = requestQueue.shift();

      return [request, {
        id: packet.ID,
        devcat: packet.devcat,
        subcat: packet.subcat,
        firmware: packet.firmware,
      }];
    }
  },
  0x62: (requestQueue, packet)=>{
    return [null, null];
  },
  0x69: (requestQueue, packet)=>{
    if(requestQueue[0].type === 0x57 && !packet.success){
      const request = requestQueue.shift();

      return [request, false];
    }
    return [null, null];
  },
  0x6A: (requestQueue, packet)=>{
    if(requestQueue[0].type === 0x57 && !packet.success){
      const request = requestQueue.shift();

      return [request, false];
    }
    return [null, null];
  },
  0x6B: (requestQueue, packet)=>{
    /* Checking request queue for correct packet */
    if(requestQueue[0].type === 0x6B){
      const request = requestQueue.shift();
      
      return [request, {
        autoLinking: packet.autoLinking,
        monitorMode: packet.monitorMode,
        autoLED: packet.autoLED,
        deadman: packet.deadman
      }];
    }
  },
  0x6D: (requestQueue, packet)=>{
    /* Checking request queue for correct packet */
    if([0x6D, 0x6E].includes(requestQueue[0].type)){
      const request = requestQueue.shift();
      
      return [request, packet.success];
    }
  },
  0x6E: (requestQueue, packet)=>{
    /* Checking request queue for correct packet */
    if([0x6D, 0x6E].includes(requestQueue[0].type)){
      const request = requestQueue.shift();
      
      return [request, packet.success];
    }
  },
  0x72: (requestQueue, packet)=>{
    /* Checking request queue for correct packet */
    if(requestQueue[0].type === 0x72){
      const request = requestQueue.shift();
      
      return [request, packet.success];
    }
  },
  0x73: (requestQueue, packet)=>{
    /* Checking request queue for correct packet */
    if(requestQueue[0].type === 0x73){
      const request = requestQueue.shift();
      
      return [request, {
        autoLinking: packet.autoLinking,
        monitorMode: packet.monitorMode,
        autoLED: packet.autoLED,
        deadman: packet.deadman
      }];
    }
  },
};