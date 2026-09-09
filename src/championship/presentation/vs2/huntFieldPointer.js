// Scene-owned adapter. It owns one pointer, never a game state or ticker.
// The gesture's viewport is fixed until release; resize cancels it explicitly.
export function createHuntFieldPointer({ getView, intents }) {
  let pointer = null;
  const valid = (event) => Number.isFinite(event?.global?.x) && Number.isFinite(event?.global?.y);
  const matches = (event) => pointer && event?.pointerId === pointer.id;
  return Object.freeze({
    down(event) {
      if (pointer || !valid(event) || event.button > 0) return false;
      const view = getView();
      if (!view) return false;
      const point = view.toWorldPoint(event.global);
      const tool = intents.toolPointerDown?.(point.x,point.y) ?? false;
      const selected = tool ? true : intents.selectWildAt(point.x, point.y);
      pointer = { id: event.pointerId, previous: { x: event.global.x, y: event.global.y }, scale: view.transform.scale, width: view.transform.viewportWidth, height: view.transform.viewportHeight, target: selected,tool,view };
      return true;
    },
    move(event) {
      if (!matches(event) || !valid(event)) return false;
      const dx = (pointer.previous.x - event.global.x) / pointer.scale;
      const dy = (pointer.previous.y - event.global.y) / pointer.scale;
      pointer.previous = { x: event.global.x, y: event.global.y };
      if(pointer.tool){const p=pointer.view.toWorldPoint(event.global);intents.toolPointerMove?.(p.x,p.y);return true;}
      if (!pointer.target) intents.panCamera(dx, dy, pointer.width, pointer.height);
      return true;
    },
    up(event) {
      if (!matches(event)) return false;
      // Touch-up has no tool submission authority. A target remains selected.
      this.move(event);
      if(pointer.tool && valid(event)){const p=pointer.view.toWorldPoint(event.global);intents.toolPointerUp?.(p.x,p.y);}
      pointer = null;
      return true;
    },
    cancel(event) {
      if (event && !matches(event)) return false;
      pointer = null;
      intents.abortEnclosureStroke();
      return true;
    },
    getOwner() { return pointer?.id ?? null; }
  });
}
