/* Libraries */
import InsteonDevice from '../InsteonDevice';
import { Packet, Byte, PacketID, MessageSubtype } from 'insteon-packet-parser';

/* Base class for device category 0x07 - Sensors & Actuators
   This is where the I/O linc lives, which is commonly used to open & close garage doors
   The rest of the devices in this category seem to be no longer available and otherwise obscure

   ***************
   *** WARNING ***
   ***************
   The 0x07 category capabilities defined by the Insteon Developer Guide, Çhapter 8 seem to be completely wrong.
   None of the described commands work with the I/O Linc, therefore the I/O Linc has been reverse engineered.

I/O Output On
cmd1: 0x45 - Turn output on
cmd2: 0x00-0xFF - the output number. I/O linc only has 1, so 0x00?

I/O Output Off
cmd1: 0x46 - Turn output off
cmd2: 0x00-0xFF - the output number. I/O linc only has 1, so 0x00?

I/O Module Control
cmd1: 0x4F
cmd2: 0x00 = Factory Reset
      0x01 = Commit RAM to EEPROM
      0x02 = Status Request (ACK contains the status)
      0x03 = Read Analog Once
      0x04 = Read Analog Always (at preset interval)
      0x05-0x08 = unused
      0x09 = Enable Status Change Message - SB 0x27 Device Status Changed broadcast message each time the input port status changes
      0x0A = Disable status change message
      0x0B = Load RAM from EEPROM
      0x0C = Enable Sensor Reading
      0x0D = Disable Sensor Reading
      0x0E = Diagnostics On - put device into self diagnostics mode
      0x0F = Diagnostics Off
 
I/O Read Configuration Port
cmd1 = 0x4E - Send read request. The 0x4D ACK contains the byte read in CMD2
cmd2 = 0x00

I/O Alarm Data Request
cmd1: 0x47 - send data request
cmd2: 0x00
Responds with ED 0x4C00 Alarm Data Response message

I/O Write Output Port (What does this do??)
cmd1: 0x48
cmd2: 0x00-0xFF - value to store. Ack contains bye written to output port in cmd2

I/O Read Input Port (What does this do??)
cmd1: 0x49
cmd2: 0x00

I/O Get sensor value
cmd1: 0x4A
cmd2: 0x00-0xFF - the sensor number to read. I/O linc only has 1, so 0x00?

I/O Set sensor 1 nominal value (what is this used for?)
cmd1: 0x4B = Set Nominal Value for Sensor 1 to reach. Other sensors can be set with ED 0x4Bxx. Set Sensor Nominal
cmd2: 0x00-0xFF = nominal value

I/O Get Sensor Alarm Delta (what is this used for?)
cmd1: 0x4C
cmd2:
	bits 0-3 = sensor number
	bits 4-6 = delta from nominal
	bit 7 = delta direction


I/O Write Configuration Port
cmd1 = 0x4D
cmd2: flags
	bit 0-1: 00 = Analog input not used. 01 = Analog input used, convert upon command. 10 = Analog Input used, convert at fixed interval
	bit   2: 1 = broadcast 0x27 on sensor alarm
	bit   3: 1 = broadcast 0x27 on input port change
	bit   4: 1 = enable 1 wire port (sensors 1-8)
	bit   5: 1 = enable all-link aliasnt to default set
	bit   6: 1 = broadcast 0x27 on output port change
	bit   7: 1 = enable output timers

 */


export default class SensorActuatorDevice extends InsteonDevice {

}