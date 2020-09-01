
import 'ol/ol.css';

import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import { XYZ, Vector as VectorSource } from 'ol/source';
import { VectorSourceEvent } from 'ol/source/Vector'
import { Geometry } from 'ol/geom';
import { fromLonLat, toLonLat } from 'ol/proj';
// import { Modify, Snap } from 'ol/interaction';
import { Snap } from 'ol/interaction';
// eslint-disable-next-line import/named
import Draw, { GeometryFunction, createBox } from 'ol/interaction/Draw';
import GeometryType from 'ol/geom/GeometryType';
// eslint-disable-next-line import/named
import { Extent } from 'ol/extent';
// import BaseEvent from 'ol/events/Event';


export class MapView {
    // 地图对象
    map: Map | undefined;
    // 放置绘制元素的图层数据源
    shapeSource: VectorSource | undefined;
    // 地图元素绘制对象
    draw: Draw | undefined;
    snap: Snap | undefined;

    /** 添加或者移除绘制元素的回调 */
    onAddOrRemoveShape: (empty: boolean) => void;
    /** 获取是否没有绘制元素 */
    get isShapesEmpty(): boolean {
        return this.shapeSource ? this.shapeSource.isEmpty() : true;
    }

    render(target: string | HTMLElement): void {
        if (document.readyState == 'complete') {
            this.initMap(target);
        } else {
            document.addEventListener('readystatechange', () => {
                if (document.readyState == 'complete') {
                    // document.removeEventListener('readystatechange', arguments.callee as () => void);
                    //
                    this.initMap(target);
                }
            });
        }
    }

    private initMap(target: string | HTMLElement): void {
        // 初始化地图及底图
        this.map = new Map({
            target: target,
            layers: [
                new TileLayer({
                    source: new XYZ({
                        url: 'https://www.google.com/maps/vt?lyrs=s&x={x}&y={y}&z={z}'
                    })
                })
            ],
            view: new View({
                center: fromLonLat([120, 30]),
                zoom: 4
            })
        });

        // 初始化用于容纳绘制元素的图层
        this.shapeSource = new VectorSource({ wrapX: false });
        this.map.addLayer(new VectorLayer({ source: this.shapeSource }));
        // 设置为可修改
        // this.map.addInteraction(new Modify({ source: this.shapeSource }));
        // 监听绘制元素的变换
        this.shapeSource.on('addfeature', (e) => this._onAddOrRemoveShape(e));
        this.shapeSource.on('removefeature', (e) => this._onAddOrRemoveShape(e));
        
        console.log(this.map);
    }

    private _onAddOrRemoveShape(e: VectorSourceEvent<Geometry>): void {
        let willEmpty = this.isShapesEmpty;
        if (e.type == "removefeature") {
            const features = this.shapeSource?.getFeatures();
            if (features && features.length > 0 && features[0] == e.feature) {
                willEmpty = true;
            }
        }
        if (this.onAddOrRemoveShape) {
            this.onAddOrRemoveShape(willEmpty);
        }
        // 绘制完成一个元素后结束绘制
        if (!willEmpty) {
            this.endDraw();
        }
    }

    /** 结束绘制 */
    endDraw(): void {
        if (this.draw && this.snap) {
            this.map?.removeInteraction(this.draw);
            this.map?.removeInteraction(this.snap);
        }
        this.draw = undefined;
        this.snap = undefined;
    }

    startDraw(type: string | GeometryType): void {
        this.shapeSource?.clear();
        //
        if (this.draw && this.snap) {
            this.map?.removeInteraction(this.draw);
            this.map?.removeInteraction(this.snap);
        }
        //
        let geometryFunc: GeometryFunction | undefined;
        if (type == "rect") {
            type = GeometryType.CIRCLE;
            geometryFunc = createBox();
        }
        //
        this.draw = new Draw({
            source: this.shapeSource,
            type: type as GeometryType,
            geometryFunction: geometryFunc
        });
        this.map?.addInteraction(this.draw);
        // 为已有元素添加修改监听
        this.snap = new Snap({
            source: this.shapeSource
        });
        this.map?.addInteraction(this.snap);
    }

    /** 开始绘制多边形 */
    startDrawPolygon(): void {
        this.startDraw(GeometryType.POLYGON);
    }

    /** 开始绘制矩形 */
    startDrawRect(): void {
        this.startDraw("rect");
    }

    /** 获取绘制图形的最小外接矩形 */
    getShapeMBR(): Extent | undefined {
        if (this.isShapesEmpty) {
            return undefined;
        }
        // console.log( this.shapeSource?.getFeatures() );
        let extent = this.shapeSource && this.shapeSource.getExtent();
        if (extent) {
            const southWest = toLonLat([extent[0], extent[1]]);
            const northEast = toLonLat([extent[2], extent[3]]);
            extent = [
                southWest[0], southWest[1],
                northEast[0], northEast[1]
            ];
        }
        return extent;
    }
}

export const mapView = new MapView();

