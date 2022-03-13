let sendBluetooth = false;
let sendUSB = false;
let lastReceivedString: String = null;
pfTransmitter.connectIrSenderLed(AnalogPin.P2)
bluetooth.startUartService()
let engine1 = 0
let engine2 = 0
let interval = 500

basic.showIcon(IconNames.Square)

bluetooth.onBluetoothConnected(function () {
    basic.showIcon(IconNames.Yes)
})

bluetooth.onBluetoothDisconnected(function () {
    basic.showIcon(IconNames.No)
})

input.onButtonPressed(Button.A, function () {
    sendBluetooth = !sendBluetooth;
})

input.onButtonPressed(Button.B, function () {
    sendUSB = !sendUSB;
})

basic.forever(function() {    
    let temp = input.temperature()
    let value = sonar.ping(DigitalPin.P2, DigitalPin.P1, PingUnit.Centimeters)
    if (sendBluetooth){
        bluetooth.uartWriteString(['temp', temp].join(',') + '\n')
        // bluetooth.uartWriteString(value + ',')
    } else if (sendUSB){
        serial.writeNumbers([value])
        // serial.writeString(temp + ',')
    }
    basic.pause(interval)
})

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

        let engine1New = 0
        let engine2New = 0

        let keys = receivedString.split(';').map(x => +x)

        for (let key of keys){
            if (!engine1New && (key == 38 || key == 40 || key == 32)){
                engine1New = key
            } else if (!engine2New && (key == 37 || key == 39)) {
                engine2New = key
            }
        }

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

        if (engine1 != engine1New){
            engine1 = engine1New

            if (engine1 == 32) {
                pfTransmitter.singleOutputMode(PfChannel.Channel2, PfOutput.Red, PfSingleOutput.BrakeThenFloat)
            } else if (engine1 == 38){
                pfTransmitter.singleOutputMode(PfChannel.Channel2, PfOutput.Red, PfSingleOutput.Backward7)
            } else if (engine1 == 40){
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
}

serial.onDataReceived(serial.delimiters(Delimiters.NewLine), function() {
    let receivedString = serial.readUntil(serial.delimiters(Delimiters.NewLine))

    messageHandler(receivedString)
})

bluetooth.onUartDataReceived(serial.delimiters(Delimiters.NewLine), function () {
    let receivedString = bluetooth.uartReadUntil(serial.delimiters(Delimiters.NewLine))

    messageHandler(receivedString)
})

input.onGesture(Gesture.Shake, function () {
    bluetooth.uartWriteString("S")
})