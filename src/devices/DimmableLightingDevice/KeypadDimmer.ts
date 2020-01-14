/* Libraries */
import DimmableLightingDevice from './DimmableLightingDevice';
import { Packet } from 'insteon-packet-parser';

/* Class for keypad dimmers (category 0x01 & subcategory 0x09/0x0A)
The keypad dimmers basically support (and inherit) all of the same methods as the DimmableLightingDevice
and these apply to the local load, which is always assigned to the first button.

Keypads have a complex setup.
Each button can have it's own ramp rate, on level, LED backlight state, toggle mode and so on.
This class provides methods for dealing with all of these keypad dimmer specifics


   Category capabilities defined by the Insteon Developer Guide, Çhapter 8:

FOR SUBCAT 0x09 & 0x0A ONLY (keypad dimmer):
Light Status Request: 0x19, 0x01 -> Returned ACK will contain LED Bit Flags in CMD2



Get Operating Flags: 0x1F, 0x00 -> Returned ACK will contain requested data in CMD2
Bit 0: 0 = Program Lock Off, 1 = On
Bit 1: 0 = LED Off during transmit, 1 = On 
Bit 2: 0 = Resume Dim Disabled, 1 = Enabled
Bit 3: 0 = 6 keys, 1 = 8 keys
Bit 4: 0 = Backlight Off, 1 = on
Bit 5: 0 = Key Beep Off, 1 = on
Bit 6&7 are not used

Set Operating Flags: 0x20, cmd2 = Flag to alter
Flags:
0x00/0x01: Program Lock On/Off
0x02/0x03: LED During Tx On/Off
0x04/0x05: Resume Dim On/Off
0x06/0x07: 8 key / 6 key
0x08/0x09: LED Backlight Off/On
0x0A/0x0B: Key Beep On/Off

EXTENDED:
Get Data Request:
cmd1: 0x2E
cmd2: 0x00
user data  1: 0x00-0xFF (target button/group #)
user data  2: 0x00 = Data Request


Data Request ACK:
user data  2: 0x01 = Data Response
user data  3: 0x00-0xFF = Button's LED Follow Mask
user data  4: 0x00-0xFF = Button's LED Off Mask
user data  5: 0x00-0xFF = Button's X10 House Code
user data  6: 0x00-0xFF = Button's X10 Unit Code
user data  7: 0x00-0xFF = Button's Ramp Rate
user data  8: 0x00-0x1F = Button's On Level
user data  9: 0x11-0x7F = Global LED Brightness
user data 10: 0x00-0xFF = Non-toggle bit. 0 = toggle, 1 = non toggle
user data 11: 0x00-0xFF = Button LED State. 0 = LED Off, 1 = LED On
user data 12: 0x00-0xFF = X10 - If bit = 0, associated button sends X10 On/Off If bit = 1, associated button sends X10 All-On/All-Off
user data 13: 0x00-0xFF = Button Non-toggle On/Off Bitmap. 0 = Send Off, 1 = Send On
user data 14: 0x00-0xFF = Button Trigger-ALL-Link Bitmap. If bit = 0, associated button sends normal Command. If bit = 0, associated button sends ED 0x30 Trigger ALL- Link Command to first device in ALDB

To set a property of a button:
cmd1: 0x2E
cmd2: 0x00
user data  1: 0x00-0xFF = Target Button
and...

Set LED Follow On Mask for button:
user data  2: 0x02 = Set LED Follow Mask.
user data  3: 0x00-0xFF. If bit is 0, LED is not affected. If bit is 1, associated button's LED follows this button's LED
user data  4-14: 0x00 (not used)

Set LED Off Mask for button:
user data  2: 0x03 = Set LED Off Mask
user data  3: 0x00-0xFF. If bit = 0, associated button’ LED is not affected. If bit = 1, associated button’s LED turns off when this button is pushed
user data  4-14: 0x00 (not used)

Set X10 Address for button:
user data  2: 0x04 = Set X10 Address
user data  3: 0x00-0xFF = X10 House Code
user data  4: 0x00-0xFF = X10 Unit Code
user data  5-14: 0x00 (not used)

Set ramp rate for button:
user data  2: 0x05 = Set ramp rate
user data  3: 0x00-0x1F = 0.1 seconds to 9 minutes
user data  4-14: 0x00 (not used)

Set on level for button
user data  2: 0x06 = Set on level
user data  3: 0x00-0x1F = On Level
user data  4-14: 0x00 (not used)

Set global LED Brightness (ignores D1)
user data  2: 0x07 = Set LED brightness
user data  3: 0x11-0x7F
user data  4-14: 0x00 (not used)

Set toggle state for button
user data  2: 0x08 = set non toggle state
user data  3: 0x00/0x01 = button is toggle/button is non toggle
user data  4-14: 0x00 (not used)

Set LED State for button
user data  2: 0x09 = set led state
user data  3: 0x00/0x01 = turn LED off/on
user data  4-14: 0x00 (not used)

Set X10 All-On State for button
user data  2: 0x0A = set x10 all-on state
user data  3: 0x00 = button sends x10 on/off
user data  3: 0x01 = button sends x10 all on/all off
user data  4-14: 0x00 (not used)

Set Non Toggle On/Off state for button
user data  2: 0x0B = set non toggle state
user data  3: 0x00 = if non toggle, button always sends off command
user data  3: 0x01 = if non toggle, button always sends on command
user data  4-14: 0x00 (not used)

Set Trigger-All-Link State for Button (what does this actually do?)
user data  2: 0x0C = set trigger all link
user data  3: 0x00 = Button sends normal command
user data  3: 0x01 = Button sends ED 0x30 Trigger All Link Command to first device in ALDB
user data  4-14: 0x00 (not used)

 */
export default class KeypadDimmer extends DimmableLightingDevice {

  public async getDeviceStatus(){

    const status = await super.getDeviceStatus();

    const ledStatus = await this.sendInsteonCommand(0x2E, 0x00, [0x00, 0x00]) as Packet.ExtendedMessageRecieved;

    // console.log(ledStatus);

    return {
      level: status.level,
      // led: ledStatus.extendedData[9],
    }

  }
}
