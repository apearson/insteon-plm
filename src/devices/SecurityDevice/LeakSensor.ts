/* Libraries */
import SecurityDevice from './SecurityDevice';
import { Packet, Byte, PacketID, MessageSubtype } from 'insteon-packet-parser';

/* Class */
export default class LeakSensor extends SecurityDevice {
	public setupEvents(){
		/* InsteonDevice emits all packets with type & subtype
		   type 0x50 = Standard Message Received
		   subtype 0x06 = Broadcast (Physically Triggered)
		 */
		this.on(['p', PacketID.StandardMessageReceived.toString(16), MessageSubtype.GroupBroadcastMessage.toString(16)], (data: Packet.StandardMessageRecieved) => {
			switch(true){
				case data.cmd1 === 0x11 && data.cmd2 === 0x01: this.emitPhysical(['sensor','dry'], data); break; // Doesn't trigger automatically. You have to click the set button to reset after water is detected
				case data.cmd1 === 0x11 && data.cmd2 === 0x02: this.emitPhysical(['sensor','wet'], data); break;
				case data.cmd1 === 0x11 && data.cmd2 === 0x04: this.emitPhysical(['heartbeat','dry'], data); break; // not tested
				case data.cmd1 === 0x13 && data.cmd2 === 0x04: this.emitPhysical(['heartbeat','wet'], data); break; // not tested
				// default: console.log("Unknown Leak Broadcast command",data.cmd1,data.cmd2);
			}
		});
	}
}