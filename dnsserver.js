/* File: DNS\DNS_SRV_Daemon.js */

// https://nodejs.org/api/dgram.html#dgram_socket_send_msg_offset_length_port_address_callback

var PORT = 53;
var HOST = '127.0.0.1';

if(!dgram)
    var dgram = require('dgram');
const server = dgram.createSocket('udp4');

server.on('listening', function () {
    var address = server.address();
    console.log('UDP Server listening on ' + address.address + ":" + address.port);
});
lastquery = {};

server.on('message', function (message, remote) {
    console.log("####")
    // console.log(Buffer.from(message));
    var DnsQuery = Buffer2DnsQuery(message);
    
    console.log("destination:\t"+JSON.stringify({"host":HOST,"port":PORT}))
    console.log("origin: \t"+JSON.stringify(remote));
    
    console.log("header: \t"+JSON.stringify(DnsQuery.header));
    console.log("question:\t"+JSON.stringify(DnsQuery.question));
    console.log("answers:\t"+JSON.stringify(DnsQuery.answer));
    /*
    var answer=[];
    for(var a=0;DnsQuery.question.length;a++)
        answer[a] = searchFunction(DnsQuery.question[a]);
    //TODO remove repeated answers AKA remove redundancies(?).
    
    
    var Response = DNSQuery2Buffer(DNSQuery);
    */
    
    client = dgram.createSocket('udp4');
    
    client.on('message',function (msg,remote2){
        server.send(msg, remote.port, remote.address,function(err){client.close()});
        setTimeout(function(){client.close();},2000);
    });    
    client.bind(remote.port-1000, remote.address);    
    
    
});
server.bind(PORT, HOST);

/* File: OBJ\Query.json */
var DNSQuery = {raw: new Buffer([]),header:{id:0,qr:false,opcode:0,aa:false,tc:false,rd:false,ra:false,z:0,rcode:0,qdcount:0,ancount:0,nscount:0,arcount:0},question:[],answer:[]};
/* File: OBJ\qtype.json */
var DNSqtype = {1:'A',2:'NS',3:'MD',4:'MF',5:'CNAME',6:'SOA',7:'MB',8:'MG',9:'MR',10:'NULL',11:'WKS',12:'PTR',13:'HINFO',14:'MINFO',15:'MX',16:'TXT',255:'*'};

/* File: DNS\Buffer_to_Query.js */
/**********************************************************************************************************************\
*    DNS Query Header Package / Packet is like this: ( each letter is a bit | divided in 8 bits = 1 Byte )
*    
*      8bit       8bit
*    AAAAAAAA AAAAAAAA
*    BCCCCDEF GHHHIIII
*    JJJJJJJJ JJJJJJJJ
*    KKKKKKKK KKKKKKKK
*    LLLLLLLL LLLLLLLL
*    MMMMMMMM MMMMMMMM
*    ######## ########
*    
*    A = INT16    Identification of the packet
*    B = BOOL    Response
*    C = INT4    Question Code
*    D = BOOL    Authority
*    E = BOOL    Truncated
*    F = BOOL    Recursion Desired
*    G = BOOL    Recursion Avaliable
*    H = ZERO    nothing. really
*    I = INT4    Response Code
*    J = INT16    Amount of Questions
*    K = INT16    Amount of Answers
*    L = INT16    Amount of NSthing
*    M = INT16    Amount of ARThing
*    # = ????    Flexibe content depends on the J,K,L and M
*    
*    details of more tecnical info here: https://tools.ietf.org/html/rfc1035#section-4.1.1
\**********************************************************************************************************************/
function Buffer2DnsQuery(req){    
    var sliceBits = function(b, off, len) {
        if(!len) len = off+1;
        var s = 7 - (off + len - 1);

        b = b >>> s;
        return b & ~(0xff << len);
    };
    

    var query = new Object(DNSQuery);

    query.raw=req;
    
    var tmpSlice;
    var tmpByte;

    query.header.id = Buffer2Number(req.slice(0,2));    // AAAAAAAA

    tmpSlice = req.slice(2,3);    // BCCCCDEF
    tmpByte = tmpSlice.toString('binary', 0, 1).charCodeAt(0);
    
    query.header.qr = sliceBits(tmpByte, 0,1)?true:false;    // B
    query.header.opcode = sliceBits(tmpByte, 1,4);    // CCCC
    query.header.aa = sliceBits(tmpByte, 5,1)?true:false;    // D
    query.header.tc = sliceBits(tmpByte, 6,1)?true:false;    // E
    query.header.rd = sliceBits(tmpByte, 7,1)?true:false;    // F

    tmpSlice = req.slice(3,4); // GHHHIIII
    tmpByte = tmpSlice.toString('binary', 0, 1).charCodeAt(0);
    
    query.header.ra = sliceBits(tmpByte, 0,1)?true:false; // G
    query.header.z = sliceBits(tmpByte, 1,3); // HHH
    query.header.rcode = sliceBits(tmpByte, 4,4); // IIII
    query.header.qdcount = Buffer2Number(req.slice(4,6)); // JJJJJJJJ JJJJJJJJ
    query.header.ancount = Buffer2Number(req.slice(6,8)); // KKKKKKKK KKKKKKKK
    query.header.nscount = Buffer2Number(req.slice(8,10)); // LLLLLLLL LLLLLLLL
    query.header.arcount = Buffer2Number(req.slice(10, 12)); // MMMMMMMM MMMMMMMM
    
// pointer to gather a range of buffer data 	
    var lastposition=12
    var position=lastposition;
	
// Gathering Questions
    var amount = query.header.qdcount;
    for(var q=0;q<amount;q++){
        lastposition=position;
        query.question[q]={};
        while(req[position++] != 0 && position < req.length);
        query.question[q].name = qname2Name( req.slice(lastposition, position) );
        query.question[q].qtype = Buffer2Number(req.slice(position, position+2));
        query.question[q].type = DNSqtype[query.question[q].qtype];
        query.question[q].qclass = Buffer2Number(req.slice(position+2, position+4));
        position+=4;
		console.log(req.slice(lastposition, position+4));
    }
	
// Gathering Answers TODO: understando those ████ers.
    var amount = query.header.ancount;
    for(var a=0;a<amount;a++){
		query.answer[a]={};
        query.answer[a].dunnoA = req.slice(lastposition, position+2);
        query.answer[a].qtype = Buffer2Number(req.slice(lastposition+2, position+4));
        query.answer[a].qclass = Buffer2Number(req.slice(lastposition+4, position+6));
        query.answer[a].TTL = Buffer2Number(req.slice(lastposition+6, position+10));
        query.answer[a].size = Buffer2Number(req.slice(lastposition+10, position+12));
	}
    


    return lastquery = query;
}
Buffer2DnsQuery(Buffer.from([0x3d,0xe5,0x81,0x80,0x00,0x01,0x00,0x04,0x00,0x00,0x00,0x00,0x03,0x77,0x77,0x77,0x0f,0x6d,0x73,0x66,0x74,0x63,0x6f,0x6e,0x6e,0x65,0x63,0x74,0x74,0x65,0x73,0x74,0x03,0x63,0x6f,0x6d,0x00,0x00,0x01,0x00,0x01,0xc0,0x0c,0x00,0x05,0x00,0x01,0x00,0x00,0x0c,0x10,0x00,0x13,0x06,0x76,0x34,0x6e,0x63,0x73,0x69,0x06,0x6d,0x73,0x65,0x64,0x67,0x65,0x03,0x6e,0x65,0x74,0x00,0xc0,0x35,0x00,0x05,0x00,0x01,0x00,0x00,0x00,0x0a,0x00,0x19,0x04,0x6e,0x63,0x73,0x69,0x08,0x34,0x2d,0x63,0x2d,0x30,0x30,0x30,0x33,0x08,0x63,0x2d,0x6d,0x73,0x65,0x64,0x67,0x65,0xc0,0x43,0xc0,0x54,0x00,0x05,0x00,0x01,0x00,0x00,0x00,0x0a,0x00,0x02,0xc0,0x59,0xc0,0x59,0x00,0x01,0x00,0x01,0x00,0x00,0x00,0x20,0x00,0x04,0x0d,0x6b,0x04,0x34]));
// do not mind this up here. its a raw capture from wireshark. yeah i am learning from there and guessing.

/*████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████*/

function DnsQuery2Buffer(DNSQuery){    
    var BufferContent = [];
    
    BufferContent[0]=0;

    for(var a=0;a<BufferContent.length;a++)
        if(BufferContent[a] >= 256)
            return new Buffer(0);
    return Buffer.from(BufferContent);
}
/*████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████*/

// function qname2Name(typeof Buffer){ return typeof String; }
var qname2Name = function(qname){
    var domain=new String();
    var position=0;

    while(qname[position] != 0 && position < qname.length)
        domain=domain + qname.toString('utf8').substring(position+1,position+=qname[position]+1) + '.';

    return domain;
};
/*████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████*/

// function qname2Name(typeof Buffer){ return typeof String; }
var Name2qname = function(qname){
    var domain=new String();
    var position=0;

    while(qname[position] != 0 && position < qname.length)
        domain=domain + qname.toString('utf8').substring(position+1,position+=qname[position]+1) + '.';

    return domain;
};
//       qname2Name(Buffer.from([0x06,0x67,0x6f,0x6f,0x67,0x6c,0x65,0x03,0x63,0x6f,0x6d,0x00]));
// copypaste into CLI to test      ^^   ^^   ^^   ^^   ^^   ^^   ^^   ^^   ^^   ^^   ^^   ^^
//                                 ◊    g    o    o    g    l    e    ◊    c    o    m    END

// ◊ = The Next N values are the UTF8 Chars and ◊ replaced with a '.' ( dot )
// END = empty value meaning that there is ZERO UTF8 Chars

/*████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████*/

// function Buffer2Number(typeof Buffer){ return typeof Number }
var Buffer2Number = function(input){
    input = input.reverse();
    var output=0;
    for(var a=input.length;a>0;a--){
        output+=input[a]<<(8*(a));
    }
    output+=input[0];
    return output;
}
// Buffer2Number(Buffer.from([0x00,0x00]));
// Buffer2Number(Buffer.from([0x00,0x01]));
// Buffer2Number(Buffer.from([0x00,0x09]));
// Buffer2Number(Buffer.from([0x00,0x0F]));
// Buffer2Number(Buffer.from([0x00,0x10]));
// Buffer2Number(Buffer.from([0x00,0xF0]));
// Buffer2Number(Buffer.from([0x01,0x00]));
// Buffer2Number(Buffer.from([0x01,0x01]));
// Buffer2Number(Buffer.from([0x01,0x04]));

// takes every INT8 in Buffer and convert to Number

/*████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████*/

// function Number2Buffer(typeof Number){ return typeof Buffer }
var Number2Buffer = function(input,BufSize){
    var output=new Buffer(BufSize);
    output
    for(var a=input.length;a>0;a--){
        output+=input[a]<<(8*(a));
    }
    output+=input[0];
    return output;
}

// takes every INT8 in Buffer and convert to Number

/*████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████*/

// function Number2Boolean(typeof Number){ return typeof Array[typeof Boolean, ... , typeof Boolean] }
var Number2Boolean = function(input,valueA,valueB){
    if(typeof input != 'number')
        return [];
    var output = [];
    var multiplier=0;
    
    while(1<<multiplier++ < input)
        output[multiplier-1]= (typeof valueA!= "undefined"?valueA:false);
    
    while(--multiplier>=0){
        if(input >= 1<<multiplier){
            input -= 1<<multiplier;
            output[multiplier] = (typeof valueB!= "undefined"?valueB:true);
        }
    }
    return output;
}

/*████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████*/

// function Boolean2Number(typeof Array[typeof Boolean, ... , typeof Boolean]){ return typeof Number }
var Boolean2Number = function(input){
    if(typeof input != "object")
        return NaN;
    var output = 0;
    var multiplier=0;
    
    while(typeof input[multiplier] != 'undefined'){
        if(input[multiplier])output+=1<<multiplier;
        ++multiplier;
    }
    
    while(--multiplier>=0){
        if(input >= 1<<multiplier){
            input -= 1<<multiplier;
            output[multiplier] = (typeof valueB!= "undefined"?valueB:true);
        }
    }
    return output;
}

/*████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████*/
