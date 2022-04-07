let sendBluetooth = true;
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
    sendBluetooth = true;
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
    serial.writeNumbers([10])
})

input.onButtonPressed(Button.AB, function () {
    legoMode += 1;

    if (legoMode > 1){
        legoMode = 0
    }

    basic.showNumber(legoMode)
})

class Sensor {
    public key: string;
    public getData: () => number;
    private interval: number;
    public lastCheck: number;
    public value: number;
    public lastValue: number;
    private status: boolean;
    private isRunning: boolean;
    private delta: number;
    private condition: (value: number, lastValue: number) => boolean;
    private onChange: (sensor: Sensor) => void;

    constructor(key: string, interval: number, getData: () => number, onChange: (sensor: Sensor) => void, delta: number = null, condition: (value: number, lastValue: number) => boolean = null) {
        this.key = key;
        this.interval = interval;
        this.getData = getData;
        this.delta = delta;
        this.condition = condition;
        this.onChange = onChange;
    }

    public setInterval(interval: number): void {
        this.interval = interval;
        bluetooth.uartWriteString(this.key + '- interval: ' + interval + '\n')
    }

    public setDelta(delta: number): void {
        this.delta = delta;
        bluetooth.uartWriteString(this.key + '- delta: ' + delta + '\n')
    }

    public stop(): void {
        this.status = false;
        bluetooth.uartWriteString(this.key + '- stop\n')

    }

    public start(): void {
        bluetooth.uartWriteString(this.key + '- start\n')

        this.status = true;
        this.isRunning = true;
        this.value = null;

        control.runInBackground(() => {
            while (this.status) {
                let getDataStart = input.runningTime();
                let value = this.getData()
                let getDataStop = input.runningTime();

                this.lastCheck = getDataStart
                let changed = true;

                if (this.delta != null && this.value != null){
                    if (value > (this.value + this.delta) || value < (this.value - this.delta)) {
                        this.value = value;
                    } else {
                        changed = false;
                    }
                } else {
                    this.value = value;
                }

                if (typeof this.condition == 'function' && !this.condition(this.value, this.lastValue)){
                    changed = false;
                }

                if (changed && typeof this.onChange == 'function') {
                    control.runInBackground(() => {
                        this.onChange(this)
                    })
                    this.lastValue = this.value
                }

                basic.pause(this.interval)
            }

            this.isRunning = false;
            bluetooth.uartWriteString(this.key + '- stopped\n')
        })
    }
}

// let messageQueue: string[] = [];
// let messageQueueRunning = false;

// function sendMessage(message: string){
//     messageQueue.push(message);
    
//     if (!messageQueueRunning){
//         messageQueueRunning = true;
//         control.runInBackground(() => {
//             while (messageQueue.length) {
//                 let message = messageQueue.shift()

//                 if (sendBluetooth) {
//                     bluetooth.uartWriteString(message)
//                 } else if (sendUSB) {
//                     // serial.writeNumbers([value, this.lastCheck, getDataStop - getDataStart])
//                     serial.writeString(message)
//                 }

//                 basic.pause(10);
//             }

//             messageQueueRunning = false;
//         })
//     }
// }

function sendData(sensor: Sensor){
    // let out = [sensor.key, sensor.value, sensor.lastCheck].join(';') + '\n'
    let out = [sensor.key, sensor.value, sensor.lastCheck].join(';') + '\n'
    if (sendBluetooth) {
        bluetooth.uartWriteString(out)
    } else if (sendUSB) {
        // serial.writeNumbers([value, this.lastCheck, getDataStop - getDataStart])
        serial.writeString(out)
    }
}

let measurements: Sensor[] = [];

// Temperature
measurements.push(new Sensor('temp', 2000, () => {
    return input.temperature()
}, sendData, 0))

// Light
measurements.push(new Sensor('light', 1000, () => {
    return input.lightLevel()
}, sendData, 10))

// Light
measurements.push(new Sensor('ax', 1000, () => {
    return input.acceleration(Dimension.X)
}, sendData, 10))

// Sonar
// measurements.push(new Sensor('sonar', 500, () => {
//     return sonar.ping(DigitalPin.P2, DigitalPin.P1, PingUnit.Centimeters)
// }))

for (let sensor of measurements){
    sensor.start()
}

function getSesorByKey(key: string): Sensor {
    return measurements.filter(s => {
        return s.key == key
    })[0]
}

function messageHandler(receivedString: String){
    let data = receivedString.split(';')

    if (data.length == 1) {
        // music.playTone(Note.C, music.beat())
        basic.showString(data[0])
        return
    }

    if (data[0] == 'WebUSB') {
        if (data[1] == 'on') {
            sendUSB = true;
        } else {
            sendUSB = false;
        }
        return
    }

    let sensor = getSesorByKey(data[0]);
    if (sensor) {
        if (data[1] == 'interval'){
            sensor.setInterval(+data[2])
        } else if (data[1] == 'delta') {
            if (data[2] == ''){
                sensor.setDelta(null)
            } else {
                sensor.setDelta(+data[2])
            }
        } else if (data[1] == 'status') {
            let status = data[2]
            if (status == 'on'){
                sensor.start()
            } else {
                sensor.stop()
            }
            
        } else if (data[1] == 'get') {
            let out = sensor.getData() + '\n';
            bluetooth.uartWriteString(out)
        }
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