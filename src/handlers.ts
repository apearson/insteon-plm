/* Library */
import PLM, { ModemRequest } from './main';
import { Packets, PacketID } from 'insteon-packet-parser';

/* Exports */
interface Handlers{
	[key: number]: any;
}

/* Packet Handling Classes */
export default {

	//#region IM to Host

	/* Standard Message Received */
	0x50: async (requestQueue: ModemRequest[], packet: Packets.StandardMessageRecieved, modem: PLM)=>{
		/* Emitting device packet */
		const deviceID = packet.from.map((byte)=> ('0'+(byte).toString(16)).slice(-2).toUpperCase()).join(':');
		modem.emit(deviceID, packet);

		/* Checking request queue for correct packet */
		if(requestQueue[0] && requestQueue[0].type === PacketID.StandardMessageReceived){
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
		if(requestQueue[0] && requestQueue[0].type === PacketID.ExtendedMessageReceived){
			const request = requestQueue.shift();

			/* Resolving request */
			request.resolve(packet);

			/* Handled */
			return true;
		}

		/* Not Handled */
		return false;
	},

	/* ALL-Linking Complete */
	0x53: async(requestQueue: ModemRequest[], packet: Packets.AllLinkingCompleted, modem: PLM)=>{
		/* Emitting ALL-Link Complete packet */
		modem.emit('linking-complete', packet);
	},

	/* ALL-Link Cleanup Failure Report */
	0x56: async (requestQueue: ModemRequest[], packet: Packets.AllLinkCleanupFailureReport, modem: PLM)=>{
		/* Emitting status report */
		modem.emit('ALl-Link Cleanup Failure Report', packet);

		/* Handled */
		return true;
	},

	/* ALL-Link Record Response */
	0x57: async (requestQueue: ModemRequest[], packet: Packets.AllLinkRecordResponse, modem: PLM)=>{
		if(requestQueue.length > 0){
			if(requestQueue[0].type === PacketID.AllLinkRecordResponse){
				const request = requestQueue.shift();

				/* Resolving request */
				request.resolve(packet);

				/* Handled */
				return true;
			}
		}
		else{
			modem.emit('AllLinkRecordResponse', packet);
		}

		/* Not Handled */
		return false;
	},

	/* ALL-Link Cleanup Status Report */
	0x58: async (requestQueue: ModemRequest[], packet: Packets.AllLinkCleanupStatusReport, modem: PLM)=>{
		/* Emitting status report */
		modem.emit('ALl-Link Cleanup Status Report', packet);

		/* Handled */
		return true;
	},

	//#endregion

	//#region Host to IM

	/* Get IM Info */
	0x60: async (requestQueue: ModemRequest[], packet: Packets.GetIMInfo)=>{
		/* Checking request queue for correct packet */
		if(requestQueue[0] && requestQueue[0].type === PacketID.GetIMInfo){
			const request = requestQueue.shift();

			/* Resolving request */
			request.resolve(packet);

			/* Handled */
			return true;
		}

		/* Not Handled */
		return false;
	},

	/* ALL Link Command */
	0x61: async (requestQueue: ModemRequest[], packet: Packets.SendAllLinkCommand)=>{
		/* Checking request queue for correct packet */
		if(requestQueue[0] && requestQueue[0].type === PacketID.SendAllLinkCommand){
			const request = requestQueue.shift();

			/* Resolving request */
			request.resolve(packet.ack);

			/* Handled */
			return true;
		}

		/* Not Handled */
		return false;
	},

	/* Send Standard or Extended Message */
	0x62: async (requestQueue: ModemRequest[], packet: Packets.SendInsteonMessage)=>{
		/* Checking request queue for correct packet */
		if(requestQueue[0] && requestQueue[0].type === PacketID.SendInsteonMessage){
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
		if(requestQueue[0] && requestQueue[0].type === PacketID.StartAllLinking){
			const request = requestQueue.shift();

			/* Resolving request */
			if(packet.ack){
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
		if(requestQueue[0] && requestQueue[0].type === PacketID.CancelAllLinking){
			const request = requestQueue.shift();

			/* Resolving request */
			if(packet.ack){
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
		if(requestQueue[0] && requestQueue[0].type === PacketID.SetHostDeviceCategory){
			const request = requestQueue.shift();

			/* Resolving request */
			request.resolve(packet);

			/* Handled */
			return true;
		}

		/* Not Handled */
		return false;
	},

	/* Modem Reset */
	0x67: async (requestQueue: ModemRequest[], packet: Packets.ResetIM)=>{
		if(requestQueue[0] && requestQueue[0].type === PacketID.ResetIM){
			/* Removing request from queue */
			const request = requestQueue.shift();

			/* Resolving request */
			packet.ack? request.resolve(packet.ack): request.reject();

			/* Handled */
			return true;
		}

		/* Not Handled */
		return false;
	},

	/* Get First ALL-Link Record */
	0x69: async (requestQueue: ModemRequest[], packet: Packets.GetFirstAllLinkRecord)=>{
		if(requestQueue[0] && requestQueue[0].type === PacketID.AllLinkRecordResponse){
			/* If request did not ack successfully */
			if(!packet.ack){
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
		if(requestQueue[0] && requestQueue[0].type === PacketID.AllLinkRecordResponse){

			/* If request did not ack successfully */
			if(!packet.ack){
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
		if(requestQueue[0] && requestQueue[0].type === PacketID.SetIMConfiguration){
			const request = requestQueue.shift();

			/* Resolving request */
			request.resolve(packet);

			/* Handled */
			return true;
		}

		/* Not Handled */
		return false;
	},

	/* Get All Link Record for Sender */
	0x6C: async (requestQueue: ModemRequest[], packet: Packets.GetAllLinkRecordforSender)=>{
		if(requestQueue[0] && requestQueue[0].type === PacketID.AllLinkRecordResponse){
			/* Removing request from queue */
			const request = requestQueue.shift();

			/* Resolving request */
			packet.ack? request.resolve(packet.ack): request.reject();

			/* Handled */
			return true;
		}

		/* Not Handled */
		return false;
	},

	/* LED On */
	0x6D: async (requestQueue: ModemRequest[], packet: Packets.LEDOn)=>{
		/* Checking request queue for correct packet */
		if(requestQueue[0] && requestQueue[0].type === PacketID.LEDOn){
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
		if(requestQueue[0] && requestQueue[0].type === PacketID.LEDOff){
			const request = requestQueue.shift();

			/* Resolving request */
			request.resolve(packet);

			/* Handled */
			return true;
		}

		/* Not Handled */
		return false;
	},

	/* Modify All link record */
	0x6F: async (requestQueue: ModemRequest[], packet: Packets.ManageAllLinkRecord)=>{
		/* Checking request queue for correct packet */
		if(requestQueue[0] && requestQueue[0].type === PacketID.ManageAllLinkRecord){
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
		if(requestQueue[0] && requestQueue[0].type === PacketID.RFSleep){
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
		if(requestQueue[0] && requestQueue[0].type === PacketID.GetIMConfiguration){
			const request = requestQueue.shift();

			/* Resolving request */
			request.resolve(packet);

			/* Handled */
			return true;
		}

		/* Not Handled */
		return false;
	},

	//#endregion
} as Handlers;