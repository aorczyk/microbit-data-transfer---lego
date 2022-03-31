let sendBluetooth = false;
let sendUSB = false;
let lastReceivedString: String = null;
pfTransmitter.connectIrSenderLed(AnalogPin.P2)
bluetooth.startUartService()
let engine1 = 0
let engine2 = 0
let interval = 500
let legoMode = 0

basic.showIcon(IconNames.Square)

bluetooth.onBluetoothConnected(function () {
    basic.showIcon(IconNames.Yes)
    // sendBluetooth = true;
})

bluetooth.onBluetoothDisconnected(function () {
    basic.showIcon(IconNames.No)
    sendBluetooth = false;
})

input.onButtonPressed(Button.A, function () {
    sendBluetooth = !sendBluetooth;
})

input.onButtonPressed(Button.B, function () {
    sendUSB = !sendUSB;
})

input.onButtonPressed(Button.AB, function () {
    legoMode += 1;

    if (legoMode > 1){
        legoMode = 0
    }

    basic.showNumber(legoMode)
})

type SensorData = {
    key: string;
    interval: number;
    lastCheck: number;
    value: number;
    status: boolean
}

class Sensor {
    private key: string;
    private handler: () => number;
    private interval: number;
    private lastCheck: number;
    private value: number;
    private status: boolean;
    private isRunning: boolean;
    private delta: number;
    private sendIf: (value: number) => boolean;

    constructor(key: string, interval: number, handler: () => number, delta: number = null, sendIf: (value: number) => boolean = null) {
        this.key = key;
        this.interval = interval;
        this.handler = handler;
        this.delta = delta;
        this.sendIf = sendIf;
    }

    public getData(interval: number): SensorData {
        this.stop()
        this.interval = interval;
        this.start()

        return {
            key: this.key,
            interval: this.interval,
            lastCheck: this.lastCheck,
            value: this.value,
            status: this.status
        }
    }

    public setInterval(interval: number): void {
        this.stop()
        this.interval = interval;
        this.start()
    }

    public stop(): void {
        this.status = false;
        while (this.isRunning) {
            basic.pause(10)
        }
    }

    public start(): void {
        this.status = true;
        this.isRunning = true;
        control.runInBackground(() => {
            while (this.status) {
                let getDataStart = input.runningTime();
                let value = this.handler()
                let getDataStop = input.runningTime();

                this.lastCheck = getDataStart
                let send = true;

                if (this.value != null){
                    if (this.delta != null){
                        if (value >= (this.value + this.delta) || value <= (this.value - this.delta)) {
                            send = true;
                            this.value = value;
                        } else {
                            send = false
                        }
                    }
                } else {
                    this.value = value;
                }

                if (send && typeof this.sendIf == 'function'){
                    send = this.sendIf(value)
                }

                if (send) {
                    let out = [this.key, value, this.lastCheck, getDataStop - getDataStart].join(',') + '\n'
                    bluetooth.uartWriteString(out)
                }

                basic.pause(this.interval)
            }

            this.isRunning = false;
        })
    }
}

// let temp2 = new Sensor('temp', 1000, () => {
//     return input.temperature()
// }, 2, (value: number) => {return value > 30})

let temp2 = new Sensor('temp', 2000, () => {
    return input.temperature()
})

temp2.start()

// control.runInBackground(() => {
//     basic.pause(5000)
//     temp2.setInterval(5000)
//     // basic.pause(6000)
//     temp2.setInterval(500)
// })

let lastOutput: string = '';

// let tasks: string[] = [];
// let schedulerIsWorking = false;
// basic.forever(function() {    
//     // // let temp = input.temperature()
//     // let temp = 5
//     // let value = sonar.ping(DigitalPin.P2, DigitalPin.P1, PingUnit.Centimeters)
    
//     // let btData = [];
    
//     // if (sendBluetooth){
//     //     btMessages.push(['time', input.runningTime(), 'temperature', temp].join(',') + '\n')
//     //     bluetooth.uartWriteString('')
//     //     // bluetooth.uartWriteString(value + ',')
//     // } else if (sendUSB){
//     //     serial.writeNumbers([value])
//     //     // serial.writeString(temp + ',')
//     // }
    
//     // basic.pause(interval)
//     let time = input.runningTime();
//     let output: number[] = [];
//     let newValue = false;

//     for (let sensor of measurements){
//         if ((time - sensor.lastCheck) > sensor.interval){
//             sensor.value = sensor.handler()
//             sensor.lastCheck = time
//             newValue = true;
//         }

//         output.push(sensor.value)
//     }

//     let outputString: string = output.join(',') + '\n'

//     // if (outputString != lastOutput){
//     //     lastOutput = outputString
//     //     tasks.push(time + ',' + outputString)
//     // }

//     if (newValue){
//         tasks.push(time + ',' + outputString)
//     }

//     if (!schedulerIsWorking && newValue){
//         schedulerIsWorking = true;

//         control.inBackground(function () {
//             while (tasks.length > 0) {
//                 let i = 0;
//                 if (sendBluetooth){
//                     bluetooth.uartWriteString(tasks[i])
//                 }
//                 tasks.splice(i, 1);
//                 basic.pause(10)
//             }

//             schedulerIsWorking = false;
//         })
//     }
// })



function messageHandler(receivedString: String){
    let data = receivedString.split(';')

    if (data.length == 1) {
        // music.playTone(Note.C, music.beat())
        basic.showString(data[0])
        return
    }

    if (data[1] == 'interval') {
        interval = +data[2]
        return
    }

    if (data[0] == 'str') {
        // music.playTone(Note.C, music.beat())
        basic.showString(data[1])
        // basic.showIcon(0)
        return
    }

    if (lastReceivedString != receivedString) {
        lastReceivedString = receivedString
        basic.clearScreen()

        if (receivedString == "38;") {
            led.plot(2, 0)
        } else if (receivedString == "39;") {
            led.plot(4, 2)
        } else if (receivedString == "37;") {
            led.plot(0, 2)
        } else if (receivedString == "40;") {
            led.plot(2, 4)
        } else if (receivedString == "38;39;") {
            led.plot(4, 0)
        } else if (receivedString == "37;38;") {
            led.plot(0, 0)
        } else if (receivedString == "37;40;") {
            led.plot(0, 4)
        } else if (receivedString == "39;40;") {
           led.plot(4, 4)
        } else {
            led.plot(2, 2)
        }

        if (legoMode == 0){
            let engine1New = 0
            let engine2New = 0

            let keys = receivedString.split(';').map(x => +x)

            for (let key of keys) {
                if (!engine1New && (key == 38 || key == 40 || key == 32)) {
                    engine1New = key
                } else if (!engine2New && (key == 37 || key == 39)) {
                    engine2New = key
                }
            }

            if (engine1 != engine1New) {
                engine1 = engine1New

                if (engine1 == 32) {
                    pfTransmitter.singleOutputMode(PfChannel.Channel2, PfOutput.Red, PfSingleOutput.BrakeThenFloat)
                } else if (engine1 == 38) {
                    pfTransmitter.singleOutputMode(PfChannel.Channel2, PfOutput.Red, PfSingleOutput.Backward7)
                } else if (engine1 == 40) {
                    pfTransmitter.singleOutputMode(PfChannel.Channel2, PfOutput.Red, PfSingleOutput.Forward7)
                } else {
                    pfTransmitter.singleOutputMode(PfChannel.Channel2, PfOutput.Red, PfSingleOutput.Float)
                }
            }

            if (engine2 != engine2New) {
                engine2 = engine2New

                if (engine2 == 39) {
                    pfTransmitter.singleOutputMode(PfChannel.Channel2, PfOutput.Blue, PfSingleOutput.Backward7)
                } else if (engine2 == 37) {
                    pfTransmitter.singleOutputMode(PfChannel.Channel2, PfOutput.Blue, PfSingleOutput.Forward7)
                } else {
                    pfTransmitter.singleOutputMode(PfChannel.Channel2, PfOutput.Blue, PfSingleOutput.Float)
                }
            }
        }

        if (legoMode == 1) {
            if (receivedString == "38;") {
                pfTransmitter.singleOutputMode(PfChannel.Channel1, PfOutput.Red, PfSingleOutput.Backward7)
                pfTransmitter.singleOutputMode(PfChannel.Channel1, PfOutput.Blue, PfSingleOutput.Forward7)
            } else if (receivedString == "39;") {
                pfTransmitter.singleOutputMode(PfChannel.Channel1, PfOutput.Red, PfSingleOutput.Backward5)
                pfTransmitter.singleOutputMode(PfChannel.Channel1, PfOutput.Blue, PfSingleOutput.Backward5)
            } else if (receivedString == "37;") {
                pfTransmitter.singleOutputMode(PfChannel.Channel1, PfOutput.Red, PfSingleOutput.Forward5)
                pfTransmitter.singleOutputMode(PfChannel.Channel1, PfOutput.Blue, PfSingleOutput.Forward5)
            } else if (receivedString == "40;") {
                pfTransmitter.singleOutputMode(PfChannel.Channel1, PfOutput.Red, PfSingleOutput.Forward7)
                pfTransmitter.singleOutputMode(PfChannel.Channel1, PfOutput.Blue, PfSingleOutput.Backward7)
            } else if (receivedString == "38;39;") {
                pfTransmitter.singleOutputMode(PfChannel.Channel1, PfOutput.Red, PfSingleOutput.Backward7)
                pfTransmitter.singleOutputMode(PfChannel.Channel1, PfOutput.Blue, PfSingleOutput.Forward2)
            } else if (receivedString == "37;38;") {
                pfTransmitter.singleOutputMode(PfChannel.Channel1, PfOutput.Red, PfSingleOutput.Backward2)
                pfTransmitter.singleOutputMode(PfChannel.Channel1, PfOutput.Blue, PfSingleOutput.Forward7)
            } else if (receivedString == "37;40;") {
                pfTransmitter.singleOutputMode(PfChannel.Channel1, PfOutput.Red, PfSingleOutput.Forward2)
                pfTransmitter.singleOutputMode(PfChannel.Channel1, PfOutput.Blue, PfSingleOutput.Backward7)
            } else if (receivedString == "39;40;") {
                pfTransmitter.singleOutputMode(PfChannel.Channel1, PfOutput.Red, PfSingleOutput.Forward7)
                pfTransmitter.singleOutputMode(PfChannel.Channel1, PfOutput.Blue, PfSingleOutput.Backward2)
            } else {
                pfTransmitter.singleOutputMode(PfChannel.Channel1, PfOutput.Red, PfSingleOutput.Float)
                pfTransmitter.singleOutputMode(PfChannel.Channel1, PfOutput.Blue, PfSingleOutput.Float)
            }
        }
    }
}

serial.onDataReceived(serial.delimiters(Delimiters.NewLine), function() {
    let receivedString = serial.readUntil(serial.delimiters(Delimiters.NewLine))

    messageHandler(receivedString)
})

bluetooth.onUartDataReceived(serial.delimiters(Delimiters.NewLine), function () {
    let receivedString = bluetooth.uartReadUntil(serial.delimiters(Delimiters.NewLine))

    messageHandler(receivedString)
})