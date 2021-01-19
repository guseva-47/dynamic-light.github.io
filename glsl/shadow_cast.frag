#ifdef GL_ES
precision highp float;
#endif

const int LIGHT_MAX_AMOUNT = 64; // максимальное количество источников света
const float LIGHT_MAX_RADIUS = 1024.; // максимальный радиус источника
const float LIGHT_FADING_RADIUS = 0.8; // часть радиуса источника света, на котором свет не затухает
const float ALPHA_THRESHOLD = 0.8; // все, что выше - препятствие, отбрасывающее тень

varying vec2 vTextureCoord; // текстурные координаты
uniform sampler2D uSampler; // карта препятствий
uniform vec4 inputSize;
uniform vec4 outputFrame;

uniform int uLightAmount; // текущее число источников света
uniform vec2 uLightPosList[LIGHT_MAX_AMOUNT];
uniform float uLightRadiusList[LIGHT_MAX_AMOUNT];
uniform vec4 uLightColorList[LIGHT_MAX_AMOUNT];


vec2 screenToTexPos(vec2 pixelPos) {
    return (pixelPos - outputFrame.xy) / inputSize.xy;
}


void main(void) {
    if (uLightAmount == 0) {
        gl_FragColor = vec4(0, 0, 0, 1);
        return;
    }

    vec4 lightColor = vec4(vec3(0), uLightColorList[0].a); // цвет пикселя
    vec2 pixelPos = vTextureCoord * inputSize.xy + outputFrame.xy; // (screen-space) координаты пикселя

    // перебор источников света
    for(int i = 0; i < LIGHT_MAX_AMOUNT; i++) {
        if (i >= uLightAmount) {
            break;
        }
        float dist = distance(uLightPosList[i], pixelPos); // (screen-space) расстояние до источника

        // пиксель будет освещен,
        // если попадает в радиус источника,
        // если между ним и источником нет препятствий,
        // или если он пренадлежит ближайшему к источнику препятствию
        if (dist <= uLightRadiusList[i]) {
            bool isLighted = true; // пиксель освещен?
            vec2 dir = normalize(uLightPosList[i] - pixelPos); // (screen-space) направление к источнику

            // исходный пиксель либо в препятствии, либо на открытом пространстве
            bool isOpenSpace = texture2D(uSampler, vTextureCoord).a <= ALPHA_THRESHOLD;
            for(float j = 1.; j < LIGHT_MAX_RADIUS; j++) { // двигаемся по одному пикселю в сторону источника
                if (j >= dist) {
                    break;
                }
                // (uv-space) координаты пикселя с возможным препятствием
                vec2 nextCoord = screenToTexPos(pixelPos + dir * j); // координаты следующего к источнику пикселя
                float nextAlpha = texture2D(uSampler, nextCoord).a; // препятствия не прозрачны
                if (nextAlpha > ALPHA_THRESHOLD) { // встретили пиксель препятсвия
                    // если для открытого пикселя встретилось препятствие
                    // или встретилось второе, то пиксель не освещается
                    if (isOpenSpace) {
                        isLighted = false;
                        break;
                    }
                } else {
                    isOpenSpace = true;
                }
            }

            if (isLighted) { // если пиксель на свету, освещаем его
                // затухание у границ света
                float fadingFactor = dist / uLightRadiusList[i] - LIGHT_FADING_RADIUS;
                fadingFactor /= 1. - LIGHT_FADING_RADIUS;
                fadingFactor = min(1. - fadingFactor, 1.);
                
                lightColor.rgb += uLightColorList[i].rgb * fadingFactor * fadingFactor;
                lightColor.a = max(lightColor.a, uLightColorList[i].a);
            }
        }
    }

    gl_FragColor = vec4(lightColor.rgb * lightColor.a, 1);
}
