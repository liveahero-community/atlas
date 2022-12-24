// Node modules.
import { readdir, readFile, mkdirp } from 'fs-extra';
import { createCanvas, Image } from 'canvas';
import * as jimp from 'jimp';

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
  const atlasData: AtlasData = JSON.parse(raw);

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

      const outputDir = 'output_raw';
      const buffer: Buffer = canvas.toBuffer('image/png');
      await mkdirp(outputDir);
      const outputPath = `${outputDir}/${textureData.name}.png`;

      // remove padding of top and right
      const jimpImage = await jimp.read(buffer);

      jimpImage.crop(
        0,
        jimpImage.getHeight() - textureData.height,
        textureData.width,
        textureData.height,
      );

      // finish
      await jimpImage.writeAsync(outputPath);
      console.log(`\t${textureData.name} is done`);
    };

    image.src = imagePath;
  });
};

const main = async () => {
  const atlasJsonDir = './artifacts/MonoBehaviour';
  const textureDir = './artifacts/Texture2D';
  const files = await readdir(atlasJsonDir);

  for (const file of files) {
    const index = files.indexOf(file) + 1;
    const matches = file.match(/(fg_\w+)\.json/);

    if (matches) {
      const { 1: fileName } = matches;
  
      // arg 1: './Texture2D/fg_ryekie_h01_skin1_Atlas0.png'
      const texturePath = `${textureDir}/${fileName}_Atlas0.png`;
      // arg 2: './Monobehaviour/fg_ryekie_h01_skin1.json'
      const atlasJsonPath = `${atlasJsonDir}/${fileName}.json`;

      console.log(`[${index} / ${files.length}] ${atlasJsonPath} with ${texturePath}`);
      await loadAltas(texturePath, atlasJsonPath);
    }
  }
};

main();
