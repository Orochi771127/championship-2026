"""Read-only stack provenance observations inside a normal DeSmuME Hunt run."""
class HuntSteeringStackObserver:
    POINTS={0x0210D8B4,0x0210D998,0x0210DAD4,0x0210DEEC,0x0210DF14}
    def __init__(self,emu,tick):
        self.emu,self.tick=emu,tick;self.active=None;self.calls=[];self.watched=set();self.last_writes={};self.error=None
        # Addresses observed in the prior same-state run; read/write hooks only.
        for a in [0x027e3a38,0x027e3a3c]:
            self.watched.add(a);self.emu.memory.register_write(a,self.write,4)
    def word(self,a):return self.emu.memory.unsigned[a:a+4:4][0]
    def vec(self,a):return [v if v<0x80000000 else v-0x100000000 for v in [self.word(a+i*4) for i in range(3)]]
    def write(self,address,size):
        r=self.emu.memory.register_arm9
        # Keep only the most recent actual writer for each observed stack word.
        for a in self.watched:
            if address<a+4 and address+size>a:
                self.last_writes[a]={'tick':self.tick(),'pc':hex(r.pc),'lr':hex(r.lr),'sp':hex(r.sp),'address':hex(address),'size':size,'r0':r.r0,'r1':r.r1,'r2':r.r2,'r3':r.r3,'r4':r.r4,'r5':r.r5}
        return True
    def observe(self,address):
        r=self.emu.memory.register_arm9
        if address==0x0210D8B4:
            self.active=None
            if r.r1!=3:return
            scratch=r.sp-0x30
            for a in [scratch,scratch+4]:
                if a not in self.watched:self.watched.add(a);self.emu.memory.register_write(a,self.write,4)
            self.active={'tick':self.tick(),'ai':hex(r.r0),'caller':hex(r.lr),'stack':hex(scratch),'positionQ12':self.vec(self.word(r.r0+0x40)+0x24),'before':self.vec(r.r0+0x60),'stackAtEntry':self.vec(scratch),'entryWriters':[self.last_writes.get(scratch+i*4) for i in range(2)]}
        elif self.active:
            a=self.active;scratch=int(a['stack'],16);ai=int(a['ai'],16)
            if address==0x0210D998:a['attribute']=r.r0
            elif address==0x0210DAD4:
                a['targetBeforeBlend']=self.vec(scratch);a['targetWriters']=[self.last_writes.get(scratch+i*4) for i in range(2)]
            elif address==0x0210DEEC:a['afterBlend']=self.vec(ai+0x60)
            elif address==0x0210DF14:
                a['afterNormalize']=self.vec(ai+0x60);self.calls.append(a);self.active=None
