// Node modules.
import { readdir, readFile, mkdirp } from 'fs-extra';
import * as sharp from 'sharp';
import { createCanvas, Image } from 'canvas';

interface TextureData {
  name: string;
  atlasName: string;
  width: number;
  height: number;
  cellIndexList: number[];
  transparentIndex: number;
}

interface AtlasData {
  m_GameObject: {
    m_FileID: number;
    m_PathID: number;
  };
  m_Enabled: number;
  m_Script: {
    m_FileID: number;
    m_PathID: number;
  };
  m_Name: string;
  cellSize: number;
  padding: number;
  atlasTextures: {
    m_FileID: number;
    m_PathID: number;
  }[];
  textureDataList: TextureData[];
}

const loadAltas = async (imagePath: string, jsonPath: string) => {
  const raw = await readFile(jsonPath, 'utf-8');
  const atlasData = JSON.parse(raw) as AtlasData;

  atlasData.textureDataList.forEach(async (textureData) => {
    const image = new Image();
    image.onload = async () => {
      const canvas = createCanvas(textureData.width, textureData.height);
      const context = canvas.getContext('2d');
      const cropCanvas = createCanvas(textureData.width, textureData.height);
      const cropContext = cropCanvas.getContext('2d');

      const { cellSize, padding } = atlasData;
      const innerSize = cellSize - 2 * padding;
      const canvasWidth = (textureData.width + innerSize - 1) - (textureData.width + innerSize - 1) % innerSize;
      const canvasHeight = (textureData.height + innerSize - 1) - (textureData.height + innerSize - 1) % innerSize;
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      context.clearRect(0, 0, canvasWidth, canvasHeight);

      textureData.cellIndexList.forEach((cellIndex, i) => {
        if (cellIndex != textureData.transparentIndex) {
          const destX = (i % (canvasWidth / innerSize) * innerSize);
          const destY = canvasHeight - innerSize * (1 + Math.floor(i / (canvasWidth / innerSize)));
          const srcX = (cellIndex % (image.width / cellSize)) * cellSize + padding;
          const srcY = image.height - cellSize * (1 + Math.floor(cellIndex / (image.width / cellSize))) + padding;

          context.drawImage(image, srcX, srcY, innerSize, innerSize, destX, destY, innerSize, innerSize);
        }
      });

      // crop at rectangle touching bottom left corner
      cropCanvas.width = textureData.width;
      cropCanvas.height = textureData.height;
      cropContext.clearRect(0, 0, textureData.width, textureData.height);
      cropContext.drawImage(canvas, 0, canvasWidth - canvasHeight, canvasHeight, canvasHeight, 0, 0, canvasWidth, canvasHeight);

      const buffer = canvas.toBuffer('image/png');
      await mkdirp('output');
      const outputPath = `output/${textureData.name}.png`;

      const sharpImage = sharp(buffer);
      const { height } = (await sharpImage.metadata());
      await sharpImage.extract({
        width: textureData.width,
        height: textureData.height,
        left: 0,
        top: height - textureData.height,
      }).toFile(outputPath);

      console.log(`${textureData.name} done`);
    };

    image.src = imagePath;
  });
};

const main = async () => {
  const atlasJsonPath = './artifacts/Monobehaviour';
  const texturePath = './artifacts/Texture2D';
  const files = await readdir(atlasJsonPath);

  for await (const file of files) {
    const { 1: fileName } = file.match(/(\w+)\.json/);

    // arg 1: './Texture2D/fg_ryekie_h01_skin1_Atlas0.png'
    // arg 2: './Monobehaviour/fg_ryekie_h01_skin1.json'
    console.log(`[Start] ${atlasJsonPath}/${fileName}.json with ${texturePath}/${fileName}_Atlas0.png`);
    await loadAltas(`${texturePath}/${fileName}_Atlas0.png`, `${atlasJsonPath}/${fileName}.json`);
  }
};

main();
