/* Libraries */
import {InsteonDevice} from './InsteonDevice';
import {PLM, Packets} from '../main';

/* Types */
import {Byte} from '../typings/typings';

/* Class */
export class OutletLinc extends InsteonDevice{
	constructor(deviceID: Byte[], modem: PLM){
		super(deviceID, modem);
	}

	/* Device Info */
	async getID(){
		return await this.sendCommand(0x07, 0x10, 0x01);
	}

	async status(){
		return await this.sendCommand(0x07, 0x19, 0x01);
	}
	/* Device Control */
	switch(port: 1 | 2, state: boolean){ return new Promise(async (resolve, reject)=>{
		/* Determing standard packet or extended packet */
		const extendedNeeded = (port == 2);

		/* Determing which way to switch device */
		const command1 = state? 0x11:0x13;
		const command2 = state? 0xFF:0x00;

		/* Setting up flags */
		const flags = extendedNeeded? 0x1F:0x0F; // 0001 1111 || 0000 1111

		/* Setting up listen for response */
		this.modem.on(this.addressString, (packet: Packets.Packet)=>{
			console.log('Got Packet');
			/* Checking if this is an ack of direct message */
			if(packet.meaningByte == 0x01){
				this.busy = false;
				resolve(packet);
			}
		});

		/* Setting up each packet */
		let userData: Byte[];
		if(extendedNeeded){
			/* Fill in user data */
			userData = [port, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00];

			/* Calulating checksum of userData */
			const checksum = this.calulateChecksum(userData);

			/* Pushing checksum onto end of userData */
			userData.push(checksum);
		}

		/* Executing command */
		await this.sendCommand(flags, command1, command2, userData);
	})}
}