/* Libraries */
import SecurityDevice from './SecurityDevice';
import { Packet, Byte, PacketID, MessageSubtype } from 'insteon-packet-parser';

/* Class */
export default class MotionSensor extends SecurityDevice {
	public setupEvents(){
		/* InsteonDevice emits all packets with type & subtype
		   type 0x50 = Standard Message Received
		   subtype 0x06 = Broadcast (Physically Triggered)
		 */
		this.on(['p', PacketID.StandardMessageReceived.toString(16), MessageSubtype.GroupBroadcastMessage.toString(16)], (data: Packet.StandardMessageRecieved) => {
			switch(true){
				case data.cmd1 === 0x11 && data.cmd2 === 0x01: this.emitPhysical(['motion','on'], data); break;
				case data.cmd1 === 0x13 && data.cmd2 === 0x01: this.emitPhysical(['motion','off'], data); break;
				case data.cmd1 === 0x11 && data.cmd2 === 0x02: this.emitPhysical(['light','dusk'], data); break;
				case data.cmd1 === 0x13 && data.cmd2 === 0x02: this.emitPhysical(['light','dawn'], data); break;
				case data.cmd1 === 0x11 && data.cmd2 === 0x03: this.emitPhysical(['battery','low'], data); break; // not tested
				case data.cmd1 === 0x13 && data.cmd2 === 0x03: this.emitPhysical(['battery','normal'], data); break; // is this right?? not tested
				// default: console.log("Unknown Broadcast command",data.cmd1,data.cmd2);
			}
		});
	}
}