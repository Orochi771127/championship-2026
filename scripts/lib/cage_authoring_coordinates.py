"""Offline art helpers. Source flips/pivots stay authoritative and unchanged."""


def placed_cell_bounds(record):
    x,y=record['placement'];px,py=record['pivot'];w,h=record['size']
    if record['horizontalFlip']:px=w-px
    if record['verticalFlip']:py=h-py
    return [x-px,y-py,w,h]


def partition_segment(a,b,cells,margin=1):
    """Split a screen-projected rope into immutable cell windows and core bridges.

    Every interval is emitted exactly once. The ordered windows select ownership
    only; they do not move a point, change the path or invent a new source cell.
    """
    cuts={0.,1.};rects=[]
    for ordinal,record in cells:
        x,y,w,h=placed_cell_bounds(record)
        rect=(x+margin,y+margin,x+w-margin,y+h-margin)
        rects.append((ordinal,rect))
        for axis,edges in [(0,(rect[0],rect[2])),(1,(rect[1],rect[3]))]:
            delta=b[axis]-a[axis]
            if delta:
                for edge in edges:
                    t=(edge-a[axis])/delta
                    if 0<t<1:cuts.add(t)
    cuts=sorted(cuts);result=[]
    for lo,hi in zip(cuts,cuts[1:]):
        if hi-lo<1e-8:continue
        mid=[a[i]+(b[i]-a[i])*(lo+hi)/2 for i in (0,1)]
        owner=next((n for n,r in rects if r[0]<=mid[0]<=r[2] and r[1]<=mid[1]<=r[3]),None)
        result.append({'owner':owner,'t0':lo,'t1':hi,
                       'a':[a[i]+(b[i]-a[i])*lo for i in (0,1)],
                       'b':[a[i]+(b[i]-a[i])*hi for i in (0,1)]})
    return result
