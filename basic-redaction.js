const Canvas = require("canvas");
const assert = require("assert").strict;
const fs = require("fs");

const PDFMerger = require('pdf-merger-js');

// const pdfBuffer = []

let pageCount = 0
const pdfData = require("./assets/textract.json");
const personalInfo = ['PRIYANGIKA DHARANI', 'SUBRAMANIAM', 'dharanips.23@gmail.com', 'Sri Lanka', 'Nev Zealand', 'Australia', 'Analysis', 'Srilanka'];

function NodeCanvasFactory() {}
NodeCanvasFactory.prototype = {
  create: function NodeCanvasFactory_create(width, height) {
    assert(width > 0 && height > 0, "Invalid canvas size");
    const canvas = Canvas.createCanvas(width, height);
    const context = canvas.getContext("2d");
    return {
      canvas,
      context,
    };
  },

  reset: function NodeCanvasFactory_reset(canvasAndContext, width, height) {
    assert(canvasAndContext.canvas, "Canvas is not specified");
    assert(width > 0 && height > 0, "Invalid canvas size");
    canvasAndContext.canvas.width = width;
    canvasAndContext.canvas.height = height;
  },

  destroy: function NodeCanvasFactory_destroy(canvasAndContext) {
    assert(canvasAndContext.canvas, "Canvas is not specified");

    // Zeroing the width and height cause Firefox to release graphics
    // resources immediately, which can greatly reduce memory consumption.
    canvasAndContext.canvas.width = 0;
    canvasAndContext.canvas.height = 0;
    canvasAndContext.canvas = null;
    canvasAndContext.context = null;
  },
};

const pdfjsLib = require("pdfjs-dist/legacy/build/pdf.js");

// Some PDFs need external cmaps.
const CMAP_URL = "./node_modules/pdfjs-dist/cmaps/";
const CMAP_PACKED = true;

// Where the standard fonts are located.
const STANDARD_FONT_DATA_URL =
  "./node_modules/pdfjs-dist/standard_fonts/";

// Loading file from file system into typed array.
const pdfPath =
  process.argv[2] || "./sample.pdf";
const data = new Uint8Array(fs.readFileSync(pdfPath));

// Load the PDF file.
const loadingTask = pdfjsLib.getDocument({
  data,
  cMapUrl: CMAP_URL,
  cMapPacked: CMAP_PACKED,
  standardFontDataUrl: STANDARD_FONT_DATA_URL,
});

function imageToPdf(imageBuffer) {
    const img = new Canvas.Image();
    img.src = imageBuffer;
    const canvas = Canvas.createCanvas(img.width, img.height, 'pdf');
    const context = canvas.getContext('2d');
    context.drawImage(img, 0, 0, img.width, img.height);
    return canvas.toBuffer();
  }

(async function () {
  try {
    const pdfDocument = await loadingTask.promise;
    console.log("# PDF document loaded.");
    console.log('> pdfDocument pages : ', pdfDocument.numPages);
    pageCount = pdfDocument.numPages;

    for (let index = 0; index < pageCount; index++) {
        // Get the first page.
        console.log('> page index : ', index);
    const page = await pdfDocument.getPage(index+1);
    // Render the page on a Node canvas with 100% scale.
    const viewport = page.getViewport({ scale: 1.0 });
    const canvasFactory = new NodeCanvasFactory();
    const canvasAndContext = canvasFactory.create(
      viewport.width,
      viewport.height
    );
    const renderContext = {
      canvasContext: canvasAndContext.context,
      viewport,
      canvasFactory,
    };

    const renderTask = page.render(renderContext);
    await renderTask.promise;

    const docPage = pdfData.Blocks.filter(b => b.BlockType === 'PAGE')[index]
    const childs = []
    if (docPage.Relationships[0].Type === 'CHILD') {
        docPage.Relationships[0].Ids.forEach(id => {
        const child = pdfData.Blocks.filter(b => b.Id === id)
        childs.push(child)
        });
    }

    const ctx = canvasAndContext.context

    childs.forEach(c => {
        if (c[0].Text) {
        personalInfo.forEach(pi => {
            if (c[0].Text.toLowerCase().includes(pi.toLowerCase())) {
            ctx.beginPath();
            ctx.fillStyle = "#333";
            ctx.fillRect(((c[0].Geometry.BoundingBox.Left * canvasAndContext.canvas.width)), ((c[0].Geometry.BoundingBox.Top * canvasAndContext.canvas.height)), (c[0].Geometry.BoundingBox.Width * canvasAndContext.canvas.width), (c[0].Geometry.BoundingBox.Height * canvasAndContext.canvas.height));
            ctx.stroke();
            }
        });
        }
    });

    canvasAndContext.canvas.toBuffer() // returns a PDF file
    canvasAndContext.canvas.createPDFStream() // returns a ReadableStream that emits a PDF
    // With optional document metadata (requires Cairo 1.16.0):
    canvasAndContext.canvas.toBuffer('application/pdf', {
    title: 'Redacted CV',
    keywords: 'redacted cv',
    creationDate: new Date()
    })

    // Convert the canvas to an image buffer.
    const image = canvasAndContext.canvas.toBuffer();
    
    const pdfBuffer = imageToPdf(image)
    fs.writeFileSync(`redacted-${index}`, pdfBuffer,'binary');
    fs.writeFile(`redacted-${index}.png`, image, function (error) {
      if (error) {
        console.error("Error: " + error);
      } else {
        console.log(
          `Finished converting page ${index} of PDF file to a PNG image.`
        );
      }
    });
    // Release page resources.
    page.cleanup();
        
    }

    var merger = new PDFMerger();

    (async () => {
      for (let index = 0; index < pageCount; index++) {
        await merger.add(`redacted-${index}`);
      }
      await merger.save('merged.pdf'); //save under given name and reset the internal document

      for (let index = 0; index < pageCount; index++) {
        fs.unlinkSync(`redacted-${index}`);
      }
      
      // Export the merged PDF as a nodejs Buffer
      // const mergedPdfBuffer = await merger.saveAsBuffer();
      // fs.writeSync('merged.pdf', mergedPdfBuffer);
    })();
    
    // console.log('> pdfBuffer : ', pdfBuffer)
    // fs.writeFileSync("redacted.pdf", pdfBuffer,'binary');
  } catch (reason) {
    console.log(reason);
  }
})();