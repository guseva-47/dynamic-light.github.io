const app = new PIXI.Application({ width: 640, height: window.innerHeight, backgroundColor: 0x0000FF });
document.body.appendChild(app.view);
PIXI.Loader.shared
    .add("images/atlas.json")
    .add('glslVertDefault', 'glsl/default.vert')
    .add('glslFragShadowCast', 'glsl/shadow_cast.frag')
    .load(setup);

//toolbar
const TOOLBAR_HEIGHT = 90
const toolbarContainer = new PIXI.Container();

let toolbar;
let wallButton, trashButton, lampButton;

const lampContainer = new PIXI.Container();
const wallContainer = new PIXI.Container();

let lampTexture, wallTextures = [];
// Главная функция, в которой все этапы работ
function setup() {
    const sheet = PIXI.Loader.shared.resources["images/atlas.json"].spritesheet;

    // загрузка текстур кнопок
    const mapTexture = PIXI.Texture.from('floor.png');
    const wallTexture = PIXI.Texture.from('stone-wall.png');
    const trashTexture = PIXI.Texture.from('trash-can.png');
    const lampButtonTexture = PIXI.Texture.from('add-lantern-flame.png');

    // загрузка текстур объектов на карте
    lampTexture = sheet.textures["lamp.png"];
    for (i = 1; i < 12; i++) wallTextures.push(PIXI.Texture.from(String(i) + '.png'))

    // создание тулбара, на нем распологаются кнопки
    toolbar = createToolbar();
    createServiceButtons(wallTexture, trashTexture, lampButtonTexture);

    // заполнение сцены начальными объектами, чтоб не была пустой
    for (i = 0; i < 5; i++) createWall();
    for (i = 0; i < 2; i++) createLamp();

    const shadowedRT = PIXI.RenderTexture.create({
        width: app.screen.width,
        height: app.screen.height - TOOLBAR_HEIGHT,
    });

    const shadowedSprite = new PIXI.Sprite(shadowedRT);
    shadowedSprite.x = 0;
    shadowedSprite.y = 0;
    shadowedSprite.width = app.screen.width;
    shadowedSprite.height = app.screen.height - TOOLBAR_HEIGHT;

    let uniforms = {};
    const shadowmapFilter = createShadowmapFilter(uniforms);
    shadowedSprite.filters = [
        shadowmapFilter,
        new PIXI.filters.BlurFilter(),
        new PIXI.filters.AlphaFilter(0.7)
    ];

    const map = new PIXI.TilingSprite(mapTexture, app.screen.width, app.screen.height)

    app.stage.addChild(map);
    app.stage.addChild(toolbarContainer);
    app.stage.addChild(wallContainer);
    app.stage.addChild(shadowedSprite);
    app.stage.addChild(lampContainer);

    app.ticker.add((delta) => {
        updateUniform(uniforms);
        app.renderer.render(wallContainer, shadowedRT, true);
    });
}

function updateUniform(uniform) {
    uniform.uLightAmount = lampContainer.children.length,
    uniform.uLightPosList = lampContainer.children.flatMap(light => [light.x, light.y]),
    uniform.uLightRadiusList = lampContainer.children.map((_, i) => ((i)%2 == 0)? 250: 200),
    uniform.uLightColorList = lampContainer.children.flatMap((_, i) => {
        const colors = [[1, 0.96, 0.58, 1], [0.8, 0.23, 0.12, 0.7], [0, 1, 0, 0.7], [0, 0, 1, 0.7]];
        return colors[i % colors.length];
    })
}

function createShadowmapFilter(uniforms) {
    const defaultVertSrc = PIXI.Loader.shared.resources.glslVertDefault.data;
    let shadowCastFragSrc = PIXI.Loader.shared.resources.glslFragShadowCast.data;

    const shadowmapFilter = new PIXI.Filter(defaultVertSrc, shadowCastFragSrc, uniforms);

    return shadowmapFilter;
}

function createToolbar() {
    const toolbar = new PIXI.Graphics();
    toolbar.beginFill(0x999999);
    toolbar.drawRect(0, 0, app.screen.width, TOOLBAR_HEIGHT);
    toolbar.endFill();
    toolbar.x = 0;
    toolbar.y = app.screen.height - TOOLBAR_HEIGHT+19;
    toolbarContainer.addChild(toolbar);
    return toolbar;
}
function createServiceButtons(wallTexture, trashTexture, lampTexture) {
    const [x, y] = [toolbar.x, toolbar.y]

    // Создание кнопки "Новая стена"
    wallButton = new PIXI.Sprite(wallTexture);
    wallButton.anchor.set(0);
    wallButton.interactive = true;
    wallButton.buttonMode = true;
    wallButton.x = x + 225;
    wallButton.y = y;
    wallButton.interactive = true;
    // this button mode will mean the hand cursor appears when you roll over the bunny with your mouse
    wallButton.buttonMode = true;
    // // setup events for mouse + touch using
    // the pointer events
    wallButton
        .on('pointerdown', pushWallButton)
    toolbarContainer.addChild(wallButton)

    // Создание кнопки "Удаление стены"
    trashButton = new PIXI.Sprite(trashTexture);
    trashButton.anchor.set(0);
    trashButton.interactive = true;
    trashButton.buttonMode = true;
    trashButton.x = x + 125;
    trashButton.y = y;
    toolbarContainer.addChild(trashButton)

    // Создание кнопки "Новый свет"
    lampButton = new PIXI.Sprite(lampTexture);
    lampButton.anchor.set(0);
    lampButton.interactive = true;
    lampButton.buttonMode = true;
    lampButton.x = x + 320;
    lampButton.y = y;
    lampButton.interactive = true;
    // this button mode will mean the hand cursor appears when you roll over the bunny with your mouse
    lampButton.buttonMode = true;
    // // setup events for mouse + touch using
    // the pointer events
    lampButton
        .on('pointerdown', pushLampButton)
    toolbarContainer.addChild(lampButton)

    return [wallButton, trashButton];
}

function createLamp() {
    const lamp = new PIXI.Sprite(lampTexture);
    lamp.interactive = true;
    lamp.buttonMode = true;
    lamp.anchor.set(0.5);

    lamp
        .on('pointerdown', onDragStart)
        .on('pointerup', onDragEnd)
        .on('pointermove', onDragMove);

    const point = randPointCenter(lamp.width, lamp.height)
    lamp.x = point.x;
    lamp.y = point.y;

    // add it to the stage
    lampContainer.addChild(lamp);
    return lamp;
}

function onDragStart(event) {
    // store a reference to the data
    // the reason for this is because of multitouch
    // we want to track the movement of this particular touch
    this.data = event.data;
    // this.alpha = 0.5;
    this.dragging = true;
}
function isForTrash(obj) {
    flag = (trashButton.x < obj.x && obj.x < trashButton.x + trashButton.width &&
        trashButton.y < obj.y && obj.y < trashButton.y + trashButton.height)
    return flag
}
function onDragEnd() {
    this.alpha = 1;
    this.dragging = false;
    // set the interaction data to null
    this.data = null;

    if (isForTrash(this)) this.destroy();
}
function onDragMove() {
    if (this.dragging) {
        const newPosition = this.data.getLocalPosition(this.parent);
        this.x = newPosition.x;
        this.y = newPosition.y;
    }
}

function randColor() {
    return '0x' + (Math.random().toString(16) + '000000').substring(2, 8).toUpperCase()
}
function randInt(min, max) {
    return Math.floor(Math.random() * (max - min) + min);
}
function randPointCenter(width = 0, height = 0) {
    const point = { x: 0, y: 0 }
    point.x = randInt(width / 2, app.screen.width - width / 2);
    point.y = randInt(height / 2, app.screen.height - (TOOLBAR_HEIGHT + height));
    return point;
}
function randRotate() {
    return Math.random() * (Math.PI * 2)
}

function newRectangle(width = 40, height = 40) {
    const graphics = new PIXI.Graphics();

    // Rectangle
    graphics.beginFill(randColor());
    graphics.drawRect(0, 0, width, height);
    graphics.endFill();

    const point = randPointCenter(width, height)
    graphics.x = point.x;
    graphics.y = point.y;
    return graphics;
}
function createWall() {
    const newWall = new PIXI.Sprite(wallTextures[randInt(1, 11)]);
    newWall.interactive = true;
    newWall.buttonMode = true;

    const point = randPointCenter(newWall.width, newWall.height)
    newWall.x = point.x;
    newWall.y = point.y;

    newWall.anchor.set(0.5);
    newWall.rotation = randRotate();

    newWall
        .on('pointerdown', onDragStart)
        .on('pointerup', onDragEnd)
        .on('pointermove', onDragMove);

    wallContainer.addChild(newWall);
}
function pushWallButton() {
    createWall();
}
function pushLampButton() {
    createLamp()
}
