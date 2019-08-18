var Promise = require('bluebird') // use Promise.finally in node 8
let noble = require('noble')
const EventEmitter = require('events')

Promise.promisifyAll([
    require('noble/lib/peripheral'),
    require('noble/lib/characteristic')
])

function toHexString(data) {
    return data.map(d => ('0' + d.toString(16)).substr(-2)).join(' ').toUpperCase()
}

function numberToByteArray(num, pad) {
    let result = []
    while(num > 0) {
        result.splice(0, 0, num & 0xFF)
        if(num > 2**32) {
            num = Math.floor(num / 256)
        } else {
            num = num >>> 8
        }
    }

    // remove leading numbers if too long
    if(result.length > pad)
        result = result.slice(result.length-pad)

    // add leading zeroes if too short
    while(result.length < pad) {
        result.splice(0, 0, 0)
    }

    return result
}

function norm(arr) {
    return Math.sqrt(arr[0]**2+arr[1]**2+arr[2]**2)
}

const sensorFields1 = [
    { name: 'reserved' }, // 0x80000000
    { name: 'reserved' }, // 0x40000000
    { name: 'reserved' }, // 0x20000000
    { name: 'reserved' }, // 0x10000000

    { name: 'reserved' }, // 0x08000000
    { name: 'reserved' }, // 0x04000000
    { name: 'unknown14' }, // 0x02000000 -
    { name: 'unknown13' }, // 0x01000000 -

    { name: 'unknown12' }, // 0x00800000 -
    { name: 'unknown11' }, // 0x00400000 -
    { name: 'reserved' }, // 0x00200000
    { name: 'reserved' }, // 0x00100000

    { name: 'reserved' }, // 0x080000
    { name: 'pitch' }, // 0x040000 - in degrees (-180 to 180)
    { name: 'roll' }, // 0x020000 - in degrees (-180 to 180)
    { name: 'yaw' }, // 0x010000 - in degrees (-180 to 180)

    { name: 'unknown10' }, // 0x008000 - acceleration?
    { name: 'unknown9' }, // 0x004000 - acceleration?
    { name: 'unknown8' }, // 0x002000 - acceleration?
    { name: 'rotationRatePitch' }, // 0x001000 - rotation rate in 0.1 degrees per second

    { name: 'rotationRateRoll' }, // 0x00800 - rotation rate in 0.1 degrees per second
    { name: 'rotationRateYaw' }, // 0x00400 - rotation rate in 0.1 degrees per second
    { name: 'unknown7' }, // 0x00200 -
    { name: 'reserved' }, // 0x00100

    { name: 'reserved' }, // 0x0080
    { name: 'locatorX' }, // 0x0040 - locator?
    { name: 'locatorY' }, // 0x0020 - locator?
    { name: 'unknown4' }, // 0x0010 -

    { name: 'unknown3' }, // 0x008 -
    { name: 'unknown2' }, // 0x004 - = sensor 0x008 * 100
    { name: 'unknown1' }, // 0x002 -
    { name: 'reserved' }, // 0x001
]

const sensorFields2 = [
    { name: 'unknown10' }, // 0x80000000 - always zero?
    { name: 'unknown9' }, // 0x40000000 - always zero?
    { name: 'unknown8' }, // 0x20000000 - always zero?
    { name: 'unknown7' }, // 0x10000000 - always zero?

    { name: 'unknown6' }, // 0x08000000 - always zero?
    { name: 'reserved' }, // 0x04000000
    { name: 'unknown5' }, // 0x02000000 -
    { name: 'unknown4' }, // 0x01000000 -

    { name: 'unknown3' }, // 0x00800000 -
    { name: 'verticalAcceleration' }, // 0x00400000 - vertical acceleration in g (9.81 m/s^2)
    { name: 'unknown1' }, // 0x00200000 -
    { name: 'reserved' }, // 0x00100000

    { name: 'reserved' }, // 0x080000
    { name: 'reserved' }, // 0x040000
    { name: 'reserved' }, // 0x020000
    { name: 'reserved' }, // 0x010000

    { name: 'reserved' }, // 0x008000
    { name: 'reserved' }, // 0x004000
    { name: 'reserved' }, // 0x002000
    { name: 'reserved' }, // 0x001000

    { name: 'reserved' }, // 0x00800
    { name: 'reserved' }, // 0x00400
    { name: 'reserved' }, // 0x00200
    { name: 'reserved' }, // 0x00100

    { name: 'reserved' }, // 0x0080
    { name: 'reserved' }, // 0x0040
    { name: 'reserved' }, // 0x0020
    { name: 'reserved' }, // 0x0010

    { name: 'reserved' }, // 0x008
    { name: 'reserved' }, // 0x004
    { name: 'reserved' }, // 0x002
    { name: 'reserved' }, // 0x001
]

class SpheroMini extends EventEmitter {
    constructor(peripheral) {
        console.log('constructor')
        super()
        this.peripheral = peripheral
        this.sequenceNumber = 0
        this.queue = Array(256) // one slot for each possible sequence number
        this.currentPacket = []
        this.escapeNext = false

        this.stay_awake = true

        this.mask1 = []
        this.mask2 = []
    }

    async connect() {
        await this.peripheral.connectAsync().timeout(10000)

        let services = await this.peripheral.discoverAllServicesAndCharacteristicsAsync().timeout(10000)

        for(let service of services) {
            console.log(service.uuid)
            if(!service.characteristics)
                continue
            for(let characteristic of service.characteristics) {
                if(characteristic.uuid == '00010002574f4f2053706865726f2121') {
                    this.apiv2characteristic = characteristic
                } else if (characteristic.uuid == '00020002574f4f2053706865726f2121') {
                    this.dfuControlCharacteristic = characteristic
                } else if(characteristic.uuid == '00020005574f4f2053706865726f2121') {
                    this.antiDoSCharacteristic = characteristic
                }
            }
        }

        if(!this.apiv2characteristic || !this.dfuControlCharacteristic || !this.antiDoSCharacteristic) {
            throw new Error('Characteristics not found')
        }

        this.apiv2characteristic.on('data', this.receiveData.bind(this));
        this.apiv2characteristic.on('notify', (data, isNotification) => console.log('notify', data, isNotification));
        await this.apiv2characteristic.subscribeAsync()

        this.dfuControlCharacteristic.on('notify', (data, isNotification) => {
            console.log('DFU', data)
        })

        await this.antiDoSCharacteristic.writeAsync(Buffer.from('usetheforce...band'), true)

        await this.wake()
    }

    async setStabilization(flag) {
        // not sure whether this is working, because error 02 is returned every time
        await this.runCommand(0x0A, 0x16, 0x0C, [flag])
    }

    async setLEDColors(intensity, red, green, blue) {
        await this.runCommand(0x0A, 0x1A, 0x0E, [0x00, 0x0F, intensity, red, green, blue])
    }

    async setMainLEDColor(red, green, blue) {
        await this.runCommand(0x0A, 0x1A, 0x0E, [0x00, 0x70, red, green, blue])
    }

    // 0 <= intensity <= 255
    async setBackLEDIntensity(intensity) {
        await this.runCommand(0x0A, 0x1A, 0x0E, [0x00, 0x01, intensity])
    }

    // conjecture: returns remaining battery voltage in 100ths of volts with maximum of 420 (4.20V)
    async getBatteryVoltage() {
        let responsePayload = await this.runCommand(0x0A, 0x13, 0x03)
        return new Buffer(responsePayload).readInt16BE(0)
    }

    // necessary to interact with sphero mini
    async wake() {
        await this.runCommand(0x0A, 0x13, 0x0D)
    }

    // switch to sleep mode (does not react to commands until wake is called)
    // sphero mini signals this by blinking in multiple colors
    async sleep() {
        await this.runCommand(0x0A, 0x13, 0x01)
    }

    // switches to deep sleep mode (does not react to any command... connect to power cable in order to send bluetooth commands again)
    async deepSleep() {
        await this.runCommand(0x0A, 0x13, 0x00)
    }

    async test() {
        return await this.runCommand(0x0A, 0x13, 0x05)
    }

    async test2(red, green, blue, red2, green2, blue2) {
        await this.runCommand(0x0A, 0x1A, 0x0E, [0x00, 0x7E, red, green, blue, red2, green2, blue2])
    }

    async driveRawMotor(motorModeLeft, speedLeft, motorModeRight, speedRight) {
        await this.runCommand(0x0A, 0x16, 0x01, [motorModeLeft, speedLeft, motorModeRight, speedRight])
    }

    async drive(speed, heading=0) {
        //                                       speed heading flags
        await this.runCommand(0x0A, 0x16, 0x07, [speed, heading >> 8, heading & 0xFF,   0])
    }

    async ping() {
        await this.runCommand(0x0A, 0x10, 0x00)
    }

    // sets mask 2
    async configureSensorStream(mask = 0) {
        let maskBytes = numberToByteArray(mask, 4)

        this.mask2 = []
        let len2 = sensorFields2.length
        for(let [k,v] of sensorFields2.entries()) {
            let bitmask = 1 << (len2-k-1)
            if((mask & bitmask) != 0) {
                this.mask2.push(v)
            }
        }

        await this.runCommand(0x0A, 0x18, 0x0C, maskBytes)
    }

    // Meth: Detection method type to use. Currently the only method supported is 01h. Use 00h to completely disable this service.
    // Xt, Yt: An 8-bit settable threshold for the X (left/right) and Y (front/back) axes of Sphero. A value of 00h disables the contribution of that axis.
    // Xspd, Yspd: An 8-bit settable speed value for the X and Y axes. This setting is ranged by the speed, then added to Xt, Yt to generate the final threshold value.
    // Dead: An 8-bit post-collision dead time to prevent retriggering; specified in 10ms increments.
    async configureCollisionDetection(method=0x01, xThreshold=100, xSpeed=100, yThreshold=100, ySpeed=100, deadTime=10) {
        await this.runCommand(0x0A, 0x18, 0x11, [method, xThreshold, xSpeed, yThreshold, ySpeed, deadTime])
    }

    async enableCollisionDetection() {
        // TODO: not working and not necessary
        await this.runCommand(0x0A, 0x18, 0x14)
    }

    // frequence: number of milliseconds between sensor reads (2 bytes)
    // sets mask 1
    async setSensorMask(frequency=1000, mask) {
        let frequencyBytes = numberToByteArray(frequency, 2)
        let maskBytes = numberToByteArray(mask, 4)
        // no idea what this 0x00 between frequency and mask is (but setting it does not yield error 7)

        this.mask1 = []
        let len1 = sensorFields1.length
        for(let [k,v] of sensorFields1.entries()) {
            let bitmask = 1 << (len1-k-1)
            if((mask & bitmask) != 0) {
                this.mask1.push(v)
            }
        }

        await this.runCommand(0x0A, 0x18, 0x00, [...frequencyBytes, 0x00, ...maskBytes])
    }

    async resetAim() {
        await this.runCommand(0x0A, 0x16, 0x06)
    }

    async resetLocator() {
        await this.runCommand(0x0A, 0x18, 0x13)
    }

    //     00h ORBOTIX_RSP_CODE_OK Command succeeded
    // 01h ORBOTIX_RSP_CODE_EGEN General, non-specific error
    // 02h ORBOTIX_RSP_CODE_ECHKSUM Received checksum failure
    // 03h ORBOTIX_RSP_CODE_EFRAG Received command fragment
    // 04h ORBOTIX_RSP_CODE_EBAD_CMD Unknown command ID
    // 05h ORBOTIX_RSP_CODE_EUNSUPP Command currently unsupported
    // 06h ORBOTIX_RSP_CODE_EBAD_MSG Bad message format
    // 07h ORBOTIX_RSP_CODE_EPARAM Parameter value(s) invalid
    // 08h ORBOTIX_RSP_CODE_EEXEC Failed to execute command
    // 09h ORBOTIX_RSP_CODE_EBAD_DID Unknown Device ID
    // 0Ah ORBOTIX_RSP_CODE_MEM_BUSY Generic RAM access needed but it is busy
    // 0Bh ORBOTIX_RSP_CODE_BAD_PASSWORD Supplied password incorrect
    // 31h ORBOTIX_RSP_CODE_POWER_NOGOOD Voltage too low for reflash operation
    // 32h ORBOTIX_RSP_CODE_PAGE_ILLEGAL Illegal page number provided
    // 33h ORBOTIX_RSP_CODE_FLASH_FAIL Page did not reprogram correctly
    // 34h ORBOTIX_RSP_CODE_MA_CORRUPT Main Application corrupt
    // 35h ORBOTIX_RSP_CODE_MSG_TIMEOUT Msg state machine timed out
    receiveData(data, isNotification) {
        //console.log('Receive data', data, isNotification)

        let send = false

        for(let byte of data) {
            if(this.escapeNext) {
                byte = byte | 0x88
                this.escapeNext = false
            } else {
                if(byte == 0x8D) {
                    this.currentPacket = []
                } else if(byte == 0xD8) {
                    send = true
                } else if(byte == 0xAB) { // escape next character
                    this.escapeNext = true
                    continue // maybe push this escape byte too
                }
            }

            this.currentPacket.push(byte)

            if(send) {
                send = false
                let [_, __, deviceId, commandId, sequenceNumber, ...rest] = this.currentPacket
                // TODO: sequence number == 0xFF ... necessary?
                if(deviceId == 0x18 && commandId == 0x02 && sequenceNumber == 0xFF){ // sensor response packet
                    let payload = rest.slice(0, -2)
                    let buffer = new Buffer(payload)

                    let result = {}
                    let i = 0;
                    for(; i < this.mask1.length; i++) {
                        result[this.mask1[i].name] = buffer.readFloatBE(i*4)
                    }
                    for(; i < this.mask2.length; i++) {
                        result[this.mask2[i].name] = buffer.readFloatBE(i*4)
                    }

                    //console.log(`Special packet (${toHexString([deviceId])}, ${toHexString([commandId])}): ${toHexString(payload)}`)

                    this.emit('data', result)
                } else if(deviceId == 0x18 && commandId == 0x12) { // collision detected
                    let payload = rest.slice(0, -2)
                    let buffer = new Buffer(payload)

                    // TODO: did not parse last 7(?) bytes
                    //console.log(`Collision (${toHexString([deviceId])}, ${toHexString([commandId])}): ${toHexString(payload)}`)

                    let collision = {
                        x: buffer.readInt16BE(0),
                        y: buffer.readInt16BE(2),
                        z: buffer.readInt16BE(4),
                        axis: buffer.readInt8(6), // 1 means left/right, 2 means forward/backward
                        xMagnitude: buffer.readInt16BE(7),
                        yMagnitude: buffer.readInt16BE(9)
                    }
                    this.emit('collision', collision)
                    // X	Y	Z	Axis	xMagnitude	yMagnitude	Speed	Timestamp
                    // 16-bit val	16-bit val	16-bit val	8-bit field	16-bit val	16-bit val	8-bit val	32-bit val
                    // Param	Description
                    // X, Y, Z	Impact components normalized as a signed 16-bit value. Use these to determine the direction of collision event. If you don't require this level of fidelity, the two Magnitude fields encapsulate the same data in pre-processed format.
                    // Axis	This bitfield specifies which axes had their trigger thresholds exceeded to generate the event. Bit 0 (01h) signifies the X axis and bit 1 (02h) the Y axis.
                    // xMagnitude	This is the power that crossed the programming threshold Xt + Xs.
                    // yMagnitude	This is the power that crossed the programming threshold Yt + Ys.
                    // Speed	The speed of Sphero when the impact was detected.
                    // Timestamp	The millisecond timer value at the time of impact; refer to the documentation of CID 50h and 51h to make sense of this value.
                } else if(deviceId == 0x13 && commandId == 0x19 && sequenceNumber == 0xFF) {
                    // checking for sequenceNumber == 0xFF important because if I send the invalid command
                    // 0x13 0x19 myself then it answers with 0x13 0x19 0xseqno 0x02 and I do not want to end up in
                    // this if case
                    console.log('Going to sleep soon')
                    if(this.stay_awake) {
                        console.log('Staying awake')
                        this.ping()
                    }
                } else if(deviceId == 0x13 && commandId == 0x1A && sequenceNumber == 0xFF) {
                    console.log('Going to sleep now')
                } else { // response to query
                    let resolve = this.queue[sequenceNumber]
                    if(resolve) {
//                         console.log(`${(new Date()).toJSON().slice(0, 19).replace(/[T]/g, ' ')} Response packet: ${toHexString(this.currentPacket)}`)
                        this.queue[sequenceNumber] = undefined
                        resolve(this.currentPacket)
                    } else {
                        // 13 1A: go to sleep soon?
                        // 8D 08 13 1A FF CB D8
                        console.log('STRANGE packet ', toHexString(this.currentPacket))
                    }
                }
            }
        }
    }

    async runCommand(permissions, deviceId, commandId, payload = []) {
        // assemble packet to write
        let sequenceNumber = this.sequenceNumber
        let content = [permissions, deviceId, commandId, sequenceNumber, ...payload]
        this.sequenceNumber = (this.sequenceNumber + 1) % 255 // skip 256 because this sequence number is reserved for special messages
        let checksum = (content.reduce((s, e) => s+e, 0)) & 0xff
        checksum = ~checksum & 0xff
        content.push(checksum)

        // escape bytes
        let packet = []
        packet.push(0x8D)
        for(let byte of content) {
            if([0xAB, 0x8D, 0xD8].includes(byte)) {
                packet.push(0xAB)
                packet.push(0x77 & byte)
            } else {
                packet.push(byte)
            }
        }
        packet.push(0xD8)

        // write and wait for response
        let response = await new Promise((resolve, reject) => {
            this.queue[sequenceNumber] = resolve

//             console.log('Write packet', toHexString(packet)) // TODO: write and catch errors
            this.apiv2characteristic.writeAsync(new Buffer(packet), true)

            // TODO: remove from queue
            setTimeout(() => reject(new Error(`Command timed out: ${toHexString(packet)}`)), 10000)
        })

        // unpack response
        let [_, responsePermissions, responseDeviceId, responseCommandId, responseSequenceNumber, responseFlag, ...rest] = response
        let responsePayload = rest.slice(0, -2)
        let responseChecksum = rest.slice(-2)[0]

        // check checksum
        let sum = ~(response.slice(1, -2).reduce((s, e) => s+e, 0)) & 0xff
        if(sum != responseChecksum) {
            console.log('Warning: checksum is not correct', responseChecksum, sum)
        }

        // check response flag
        if(responseFlag > 0) {
            console.log('Warning: response flag is not zero', responseFlag)
        }

        return responsePayload
    }

    async disconnect() {
        await this.peripheral.disconnectAsync()
    }
}

let findSpheroMini = (timeout = 5000) => {
    let listener = undefined

    return new Promise((resolve, reject) => {
        listener = (peripheral) => {
            if(peripheral.advertisement.localName && peripheral.advertisement.localName.startsWith('SM')) {
                resolve(new SpheroMini(peripheral))
            }
        }

        noble.on('discover', listener)
        noble.startScanning()

        setTimeout(()=>reject(new Error('Could not find a Sphero Mini')), timeout)
    }).finally(() => {
        noble.stopScanning()
        noble.removeListener('discover', listener)
    })
}

module.exports = findSpheroMini
