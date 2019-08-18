var Promise = require('bluebird')
let findSpheroMini = require('./index.js')
let express = require('express')

async function prepareSphero() {
    let sphero = undefined
    try {
        sphero = await findSpheroMini()
        console.log('found: ', sphero != undefined)
        await sphero.connect()

        console.log('set colors')
        await sphero.runCommand(0x0A, 0x1A, 0x0E, [0x00, 0x70, 0x00, 0x00, 0x00]) // main light
        await sphero.runCommand(0x0A, 0x1A, 0x0E, [0x00, 0x0F, 0x00, 0x00, 0x00, 0x00])
        await sphero.runCommand(0x0A, 0x1A, 0x0E, [0x00, 0x01, 0x00]) // back light
        await sphero.runCommand(0x0A, 0x1A, 0x19)

        console.log('get battery')
        let battery = await sphero.getBatteryVoltage()
        console.log('Battery in %: ', battery/420*100)

    //         console.log('disable stabilization')
    //         await sphero.setStabilization(1)

        console.log('reset locator')
        await sphero.resetLocator()

        console.log('configure collision detection')
//         sphero.on('collision', (collision) => {
//             console.log(collision)
//         })
        await sphero.configureCollisionDetection()

        console.log('configure sensor stream')
//         sphero.on('data', (data) => {
//             for(let [k,v] of Object.entries(data))  {
//                 data[k] = v.toFixed(3)
//             }
//             console.log(JSON.stringify(data))
//         })
        await sphero.setSensorMask(1000, 0x00000060) //0x0000021E
        await sphero.configureSensorStream(0x00000000) // 03 A0 00 00
    } catch(e) {
        console.log('error', e)
        if(sphero) {
            try {
                await sphero.configureSensorStream()
                await sphero.sleep()
                await sphero.disconnect()
            } catch(e) {}
        }
        return undefined
    }

    return sphero
}




// var bodyParser = require('body-parser');
// app.use(bodyParser.json());
// app.use(bodyParser.urlencoded({ extended: true }));

let sphero = undefined

class SpheroServer {
    constructor(port) {
        this.port = port
        this.started = false
        this.sensorData = {}
    }

    async start() {
        if(!this.started) {
            if(!sphero) {
                console.log('Searching for sphero')
                sphero = await prepareSphero()
                sphero.on('data', (data) => {
                    this.sensorData = data
                })
                this.sphero = sphero
            }

            console.log(`Starting server at port ${this.port}`)
            let app = express()
            app.get('/drive', async function(req, res) {
                let { speed = '0', angle = '0' } = req.query
                await sphero.drive(parseInt(speed), parseInt(angle))
                res.sendStatus(200)
            })

            app.get('/backlight', async function(req, res) {
                let { brightness = '0' } = req.query
                await sphero.runCommand(0x0A, 0x1A, 0x0E, [0x00, 0x01, parseInt(brightness)])
                res.sendStatus(200)
            })

            app.get('/resetAim', async function(req, res) {
                await sphero.resetAim()
                res.sendStatus(200)
            })

            app.get('/resetLocator', async function(req, res) {
                await sphero.resetLocator()
                res.sendStatus(200)
            })

            app.get('/getSensorData', async (req, res) => {
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(this.sensorData));
            })

            app.get('/play', async (req, res) => {
                //let { speed = '0', angle = '0' } = req.query

                sphero.resetLocator()

                let x = this.sensorData.locatorX, y = this.sensorData.locatorY
                console.log("start: " + x + "," + y)

                await Promise.delay(19550) //-200

                // preparation 1
                await sphero.drive(50, 0)
                await Promise.delay(650)
                await sphero.drive(40, 0)
                await Promise.delay(200)
                await sphero.drive(30, 0)
                await Promise.delay(200)
                await sphero.drive(20, 0)
                await Promise.delay(200)
                await sphero.drive(10, 0)

                //await Promise.delay(2000) // no delays

                await Promise.delay(100) //-200

                // preparation 2
                await sphero.drive(0,350)
                await Promise.delay(50)
                await sphero.drive(0,340)
                await Promise.delay(50)
                await sphero.drive(0,330)
                await Promise.delay(50)
                await sphero.drive(0,320)
                await Promise.delay(50)
                await sphero.drive(0,310)
                await Promise.delay(50)
                await sphero.drive(0,300)
                await Promise.delay(50)
                await sphero.drive(0,290)
                await Promise.delay(50)
                await sphero.drive(0,280)
                await Promise.delay(50)
                await sphero.drive(0,271)
                await Promise.delay(50)

                await sphero.drive(62, 271)
                await Promise.delay(1000)
                await sphero.drive(50, 271)
                await Promise.delay(200)
                await sphero.drive(40, 271)
                await Promise.delay(200)
                await sphero.drive(30, 271)
                await Promise.delay(200)
                await sphero.drive(20, 271)
                await Promise.delay(200)
                await sphero.drive(10, 271)

                //await Promise.delay(6033) // no delays

                await Promise.delay(1733) // -100

                // 1.
                await sphero.drive(0,260)
                await Promise.delay(300)
                await sphero.drive(0,250)
                await Promise.delay(300)
                await sphero.drive(0,240)
                await Promise.delay(300)
                await sphero.drive(0,230)
                await Promise.delay(300)
                await sphero.drive(0,220)
                await Promise.delay(300)
                await sphero.drive(0,210)
                await Promise.delay(300)
                await sphero.drive(0,198.5)
                await Promise.delay(300)

                await sphero.drive(93, 198.5)
                await Promise.delay(1900)
                await sphero.drive(80, 198.5)
                await Promise.delay(300)
                await sphero.drive(70, 198.5)
                await Promise.delay(300)
                await sphero.drive(60, 198.5)
                await Promise.delay(300)
                await sphero.drive(50, 198.5)
                await Promise.delay(300)
                await sphero.drive(40, 198.5)
                await Promise.delay(300)
                await sphero.drive(30, 198.5)
                await Promise.delay(300)
                await sphero.drive(20, 198.5)
                await Promise.delay(300)
                await sphero.drive(10, 198.5)

                //await Promise.delay(8767) // no delays

                await Promise.delay(1267) //-400

                // 2.
                await sphero.drive(0,190)
                await Promise.delay(300)
                await sphero.drive(0,180)
                await Promise.delay(300)
                await sphero.drive(0,170)
                await Promise.delay(300)
                await sphero.drive(0,160)
                await Promise.delay(300)
                await sphero.drive(0,150)
                await Promise.delay(300)
                await sphero.drive(0,140)
                await Promise.delay(300)
                await sphero.drive(0, 130)

                await Promise.delay(1300)

                await sphero.drive(70, 130)
                await Promise.delay(1450)
                await sphero.drive(60, 130)
                await Promise.delay(300)
                await sphero.drive(50, 130)
                await Promise.delay(300)
                await sphero.drive(40, 130)
                await Promise.delay(300)
                await sphero.drive(30, 130)
                await Promise.delay(300)
                await sphero.drive(20, 130)
                await Promise.delay(300)
                await sphero.drive(10, 130)

                //await Promise.delay(7150) // no delays

                await Promise.delay(1850) //-550

                // 3.
                await sphero.drive(0,140)
                await Promise.delay(200)
                await sphero.drive(0,150)
                await Promise.delay(200)
                await sphero.drive(0,160)
                await Promise.delay(200)
                await sphero.drive(0,170)
                await Promise.delay(200)
                await sphero.drive(0,180)
                await Promise.delay(200)
                await sphero.drive(0,190)
                await Promise.delay(200)
                await sphero.drive(0,200)
                await Promise.delay(200)
                await sphero.drive(0,210)
                await Promise.delay(200)
                await sphero.drive(0,220.8)
                await Promise.delay(200)

                await sphero.drive(58, 220.8)
                await Promise.delay(1800)
                await sphero.drive(50, 220.8)
                await Promise.delay(300)
                await sphero.drive(40, 220.8)
                await Promise.delay(300)
                await sphero.drive(30, 220.8)
                await Promise.delay(300)
                await sphero.drive(20, 220.8)
                await Promise.delay(300)
                await sphero.drive(10, 220.8)

                //await Promise.delay(4583) // no delays

   //             await Promise.delay(33) //-200

                let x2 = this.sensorData.locatorX, y2 = this.sensorData.locatorY
                console.log("end: " + x2 + "," + y2)
                console.log("diff: " + (x2 - x) + "," + (y2 - y))

                // 4.
   /*             await sphero.drive(0,220)
                await Promise.delay(150)
                await sphero.drive(0,210)
                await Promise.delay(150)
                await sphero.drive(0,200)
                await Promise.delay(150)
                await sphero.drive(0,190)
                await Promise.delay(150)
                await sphero.drive(0,180)
                await Promise.delay(150)
                await sphero.drive(0,170)
                await Promise.delay(150)
                await sphero.drive(0, 160)
                await Promise.delay(150)
                await sphero.drive(0, 150)
                await Promise.delay(150)
                await sphero.drive(0, 140)
                await Promise.delay(150)

                await sphero.drive(40, 140)*/

                await Promise.delay(33) //-200

                // 4.
                await sphero.drive(0,220)
                await Promise.delay(150)
                await sphero.drive(0,210)
                await Promise.delay(150)
                await sphero.drive(0,200)
                await Promise.delay(150)
                await sphero.drive(0,190)
                await Promise.delay(150)
                await sphero.drive(0,180)
                await Promise.delay(150)
                await sphero.drive(0,170)
                await Promise.delay(150)
                await sphero.drive(0, 160)
                await Promise.delay(150)
                await sphero.drive(0, 150)
                await Promise.delay(150)

                res.sendStatus(200)
            })

            app.get('/playFinish', async (req, res) => {

                let { angle = '140', speed = '40' } = req.query
                angle = parseInt(angle)
                speed = parseInt(speed)

                console.log('playFinish', angle, speed)

                await sphero.drive(0, angle)
                await Promise.delay(150)

                await sphero.drive(speed, angle)

                res.sendStatus(200)
            })

            app.get('/playSlow', async (req, res) => {
                //let { speed = '0', angle = '0' } = req.query

                sphero.resetLocator()

                let x = this.sensorData.locatorX, y = this.sensorData.locatorY
                console.log("start: " + x + "," + y)

                await Promise.delay(19550) //-200

                // preparation 1
                await sphero.drive(35,0)

                //await Promise.delay(2000) // no delays
                await Promise.delay(1550)

                // preparation 2
                await sphero.drive(0,350)
                await Promise.delay(50)
                await sphero.drive(0,340)
                await Promise.delay(50)
                await sphero.drive(0,330)
                await Promise.delay(50)
                await sphero.drive(0,320)
                await Promise.delay(50)
                await sphero.drive(0,310)
                await Promise.delay(50)
                await sphero.drive(0,300)
                await Promise.delay(50)
                await sphero.drive(0,290)
                await Promise.delay(50)
                await sphero.drive(0,280)
                await Promise.delay(50)
                await sphero.drive(0,271)
                await Promise.delay(50)

                await sphero.drive(45,271)

                //await Promise.delay(6033) // no delays

                await Promise.delay(3633) // -300

                // 1.
                await sphero.drive(0,260)
                await Promise.delay(300)
                await sphero.drive(0,250)
                await Promise.delay(300)
                await sphero.drive(0,240)
                await Promise.delay(300)
                await sphero.drive(0,230)
                await Promise.delay(300)
                await sphero.drive(0,220)
                await Promise.delay(300)
                await sphero.drive(0,210)
                await Promise.delay(300)
                await sphero.drive(0,198.5)
                await Promise.delay(300)

                //await sphero.drive(56, 198.5)
                //await Promise.delay(1400)
                await sphero.drive(80, 198.5)
                await Promise.delay(2200)
                //await sphero.drive(50, 198.5)
                //await Promise.delay(1600)
                await sphero.drive(40, 198.5)
                await Promise.delay(1800)
                await sphero.drive(30, 198.5)
                await Promise.delay(1400)

                //await Promise.delay(8767) // no delays

                await Promise.delay(267)

                // 2.
                await sphero.drive(0,190)
                await Promise.delay(300)
                await sphero.drive(0,180)
                await Promise.delay(300)
                await sphero.drive(0,170)
                await Promise.delay(300)
                await sphero.drive(0,160)
                await Promise.delay(300)
                await sphero.drive(0,150)
                await Promise.delay(300)
                await sphero.drive(0,140)
                await Promise.delay(300)
                await sphero.drive(0, 130)

                await Promise.delay(300)

                await sphero.drive(38, 130)
                await Promise.delay(1800)
                await sphero.drive(35, 130)
                await Promise.delay(1800)
                await sphero.drive(28, 130)
                await Promise.delay(1400)

                //await Promise.delay(7150) // ohne delays

                await Promise.delay(350)

                // 3. Schlag
                await sphero.drive(0,140)
                await Promise.delay(200)
                await sphero.drive(0,150)
                await Promise.delay(200)
                await sphero.drive(0,160)
                await Promise.delay(200)
                await sphero.drive(0,170)
                await Promise.delay(200)
                await sphero.drive(0,180)
                await Promise.delay(200)
                await sphero.drive(0,190)
                await Promise.delay(200)
                await sphero.drive(0,200)
                await Promise.delay(200)
                await sphero.drive(0,210)
                await Promise.delay(200)
                await sphero.drive(0,220.8)
                await Promise.delay(200)

                /*await sphero.drive(40, 220.8)
                await Promise.delay(1300)
                await sphero.drive(30, 220.8)
                await Promise.delay(1000)
                await sphero.drive(20, 220.8)
                await Promise.delay(1000)*/

                sphero.drive(50, 220.8)
                await Promise.delay(1800)
                sphero.drive(40, 220.8)
                await Promise.delay(1500)

                //await Promise.delay(4583) // no delays

                await Promise.delay(83)

                let x2 = this.sensorData.locatorX, y2 = this.sensorData.locatorY
                console.log("end: " + x2 + "," + y2)
                console.log("diff: " + (x2 - x) + "," + (y2 - y))

                // 4. Schlag
                await sphero.drive(0,220)
                await Promise.delay(150)
                await sphero.drive(0,210)
                await Promise.delay(150)
                await sphero.drive(0,200)
                await Promise.delay(150)
                await sphero.drive(0,190)
                await Promise.delay(150)
                await sphero.drive(0,180)
                await Promise.delay(150)
                await sphero.drive(0,170)
                await Promise.delay(150)
                await sphero.drive(0, 160)
                await Promise.delay(150)
                await sphero.drive(0, 150)
                await Promise.delay(150)

                await sphero.drive(80, 150)

                res.sendStatus(200)
            })

            app.get('/dummy', async (req, res) => {

                let { angle = '0', speed = '0' } = req.query

                console.log('Dummy ', angle, speed)

                res.sendStatus(200)
            })

            this.app = app
            this.server = app.listen(this.port)

            this.started = true
        }


    }

    async stop() {
        if(this.started) {
            console.log('Disconnect sphero')
            await sphero.configureSensorStream()
            await sphero.sleep()
            await sphero.disconnect()

            console.log('Stopping server')
            this.server.close()
            this.started = false
        }
    }
}

function createSpheroServer(port=8080) {
    return new SpheroServer(port)
}

module.exports = createSpheroServer
