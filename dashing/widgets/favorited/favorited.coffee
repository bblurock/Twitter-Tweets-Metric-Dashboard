class Dashing.Favorited extends Dashing.Widget

  createChart: (seriesOptions) ->
    $('#favorited').highcharts 'StockChart',
      title: text: 'Daily Favorited Count'
      legend: enabled: true
      rangeSelector:
        selected: 4
        allButtonsEnabled: true
        enable: true
      yAxis:
#        min: 500
#        max: 80000
#        labels: formatter: ->
#          (if @value > 0 then ' + ' else '') + @value + '%'
        plotLines: [ {
          value: 0
          width: 1
          color: 'silver'
        } ]
        min: 0
      plotOptions:
        series:
          lineWidth: 1
          # compares: 'value'
        spline:
          marker:
            enabled: true
      
      tooltip:
        pointFormat: '<span style="color:{series.color}">{series.name}</span>: {point.y}<br/>'
        valueDecimals: 0
      series: seriesOptions
    return

  onData: (data) ->
    legendDefault = {
      "tickleapp": true,
      "wonderworkshop": false, 
      "spheroedu": false,
      "gotynker": false,
      "hopscotch": false,
      "codehs": false,
      "kodable": false,
      "codeorg": false,
      "scratch": false,
      "trinketapp": false
    }
    
    data = JSON.parse(data.data)
    data.map (x) ->
      x.visible = legendDefault[x.name]
      
    @createChart(data)
    