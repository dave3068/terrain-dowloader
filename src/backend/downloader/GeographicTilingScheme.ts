
import { Point, Rectangle } from "./types";

/**
 * 瓦片计算方案
 */
export default class GeographicTilingScheme {
    numberOfLevelZeroTilesX = 2;
    numberOfLevelZeroTilesY = 1;
    rectangle: Rectangle = new Rectangle(-180, -90, 180, 90);

    /** 获取指定缩放层级的每行最多瓦片数 */
    getNumberOfXTilesAtLevel(level: number): number {
        return this.numberOfLevelZeroTilesX << level;
    }
    /** 获取指定缩放层级的每列最多瓦片数 */
    getNumberOfYTilesAtLevel(level: number): number {
        return this.numberOfLevelZeroTilesY << level;
    }

    /**
     * 计算坐标位置对应的瓦片索引位置
     * @param level 所处缩放层级
     * @param position 坐标位置
     * @returns [ xIndex, yIndex ]
     */
    positionToTileXY(level: number, position: Point): Point {
        const rectangle = this.rectangle;

        const xTiles = this.getNumberOfXTilesAtLevel(level);
        const yTiles = this.getNumberOfYTilesAtLevel(level);

        const xTileWidth = rectangle.width / xTiles;
        const yTileHeight = rectangle.height / yTiles;

        let longitude = position[0];
        const latitude = position[1];
        if (rectangle.east < rectangle.west) {
            longitude += 360;
        }

        let xTileCoordinate = (longitude - rectangle.west) / xTileWidth | 0;
        if (xTileCoordinate >= xTiles) {
            xTileCoordinate = xTiles - 1;
        }

        let yTileCoordinate = (rectangle.north - latitude) / yTileHeight | 0;
        if (yTileCoordinate >= yTiles) {
            yTileCoordinate = yTiles - 1;
        }

        return [xTileCoordinate, yTiles - yTileCoordinate];
    }

    // tileXYToRectangle(level: number, x: number, y: number): Rectangle {
    // }
}
