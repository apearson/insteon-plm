/* Library */
import {PLM, ModemRequest} from './main';
import {Packets, PacketID} from '../../insteon-packet-parser/dist/main';
import {EventEmitter} from 'events';

/* Exports */
export interface handlers{
  [key: number]: any;
}

/* Packet Handling Classes */
export const handlers: handlers = {
  /** IM to Host **/
  /* Standard Message Received */
  0x50: async (requestQueue: ModemRequest[], packet: Packets.StandardMessageRecieved, modem: PLM)=>{
    /* Emitting device packet */
    const deviceID = packet.from.map((byte)=> ('0'+(byte).toString(16)).slice(-2).toUpperCase()).join(':');
    modem.emit(deviceID, packet);

    /* Checking request queue for correct packet */
    if(requestQueue[0] != null && requestQueue[0].type === 0x50){
      const request = requestQueue.shift();

      /* Resolving request */
      request.resolve(packet);

      /* Handled */
      return true;
    }

    /* Not Handled */
    return false;
  },
  /* Extended Message Received */
  0x51: async (requestQueue: ModemRequest[], packet: Packets.ExtendedMessageRecieved)=>{
    /* Checking request queue for correct packet */
    if(requestQueue[0].type === 0x51){
      const request = requestQueue.shift();

      /* Resolving request */
      request.resolve(packet);

      /* Handled */
      return true;
    }

    /* Not Handled */
    return false;
  },
  /* ALL-Link Record Response */
  0x57: async (requestQueue: ModemRequest[], packet: Packets.AllLinkRecordResponse)=>{
    if(requestQueue[0].type === 0x57){
      const request = requestQueue.shift();

      /* Resolving request */
      request.resolve(packet);

      /* Handled */
      return true;
    }

    /* Not Handled */
    return false;
  },

  /** Host to IM **/
  /* Get IM Info */
  0x60: async (requestQueue: ModemRequest[], packet: Packets.GetIMInfo)=>{
    /* Checking request queue for correct packet */
    if(requestQueue[0].type === 0x60){
      const request = requestQueue.shift();

      /* Resolving request */
      request.resolve(packet);

      /* Handled */
      return true;
    }

    /* Not Handled */
    return false;
  },
  /* Send Standard or Extended Message */
  0x62: async (requestQueue: ModemRequest[], packet: Packets.SendInsteonMessage)=>{
    /* Checking request queue for correct packet */
    if(requestQueue[0].type === 0x62){
      const request = requestQueue.shift();

      /* Resolving request */
      request.resolve(packet);

      /* Handled */
      return true;
    }

    /* Not Handled */
    return false;
  },
  /* Start ALL-Linking */
  0x64: async (requestQueue: ModemRequest[], packet: Packets.StartAllLinking)=>{
    if(requestQueue[0].type === 0x64){
      const request = requestQueue.shift();

      /* Resolving request */
      if(packet.success){
        request.resolve(packet);
      }
      else{
        request.reject();
      }

      /* Handled */
      return true;
    }

    /* Not Handled */
    return false;
  },
  /* Cancel ALL-Linking */
  0x65: async (requestQueue: ModemRequest[], packet: Packets.CancelAllLinking)=>{
    if(requestQueue[0].type === 0x65){
      const request = requestQueue.shift();

      /* Resolving request */
      if(packet.success){
        request.resolve(packet);
      }
      else{
        request.reject();
      }

      /* Handled */
      return true;
    }

    /* Not Handled */
    return false;
  },
  /* Set Host Device Category */
  0x66: async (requestQueue: ModemRequest[], packet: Packets.SetHostDeviceCategory)=>{
    if(requestQueue[0].type === 0x65){
      const request = requestQueue.shift();

      /* Resolving request */
      request.resolve(packet);

      /* Handled */
      return true;
    }

    /* Not Handled */
    return false;
  },
  /* Get First ALL-Link Record */
  0x69: async (requestQueue: ModemRequest[], packet: Packets.GetFirstAllLinkRecord)=>{
    if(requestQueue[0].type === 0x57){
      /* If request did not ack successfully */
      if(!packet.success){
        const request = requestQueue.shift();

        request.resolve(false);
        return true;
      }
    }

    /* Not Handled */
    return false;
  },
  /* Get Next ALL-Link Record */
  0x6A: async (requestQueue: ModemRequest[], packet: Packets.GetNextAllLinkRecord)=>{
    if(requestQueue[0].type === 0x57){

      /* If request did not ack successfully */
      if(!packet.success){
        const request = requestQueue.shift();

        request.resolve(false);
        return true;
      }
    }

    /* Not Handled */
    return false;
  },
  /* Set IM Configuration */
  0x6B: async (requestQueue: ModemRequest[], packet: Packets.SetIMConfiguration)=>{
    /* Checking request queue for correct packet */
    if(requestQueue[0].type === 0x6B){
      const request = requestQueue.shift();

      /* Resolving request */
      request.resolve(packet);

      /* Handled */
      return true;
    }

    /* Not Handled */
    return false;
  },
  /* LED On */
  0x6D: async (requestQueue: ModemRequest[], packet: Packets.LEDOn)=>{
    /* Checking request queue for correct packet */
    if(requestQueue[0].type === 0x6D){
      const request = requestQueue.shift();

      /* Resolving request */
      request.resolve(packet);

      /* Handled */
      return true;
    }

    /* Not Handled */
    return false;
  },
  /* LED Off */
  0x6E: async (requestQueue: ModemRequest[], packet: Packets.LEDOff)=>{
    /* Checking request queue for correct packet */
    if(requestQueue[0].type === 0x6E){
      const request = requestQueue.shift();

      /* Resolving request */
      request.resolve(packet);

      /* Handled */
      return true;
    }

    /* Not Handled */
    return false;
  },
  /* RF Sleep */
  0x72: async (requestQueue: ModemRequest[], packet: Packets.RFSleep)=>{
    /* Checking request queue for correct packet */
    if(requestQueue[0].type === 0x72){
      const request = requestQueue.shift();

      /* Resolving request */
      request.resolve(packet);

      /* Handled */
      return true;
    }

    /* Not Handled */
    return false;
  },
  /* Get IM Configuration */
  0x73: async (requestQueue: ModemRequest[], packet: Packets.GetIMConfiguration)=>{
    /* Checking request queue for correct packet */
    if(requestQueue[0].type === 0x73){
      const request = requestQueue.shift();

      /* Resolving request */
      request.resolve(packet);

      /* Handled */
      return true;
    }

    /* Not Handled */
    return false;
  },
};