class Dashing.Shared extends Dashing.Widget

  createChart: (seriesOptions) ->
    $('#shared').highcharts 'StockChart',
      title: text: 'Daily Original Shared Count<br/>(by Twitter Webapp)'
      legend: enabled: true
      # subtitle: text: 'This chart display the number of times which their tweets be retweeted by other user. <br/>!! Note: only the most recent 3200 tweets will be counted.'
      rangeSelector:
        selected: 4
        allButtonsEnabled: true
        enable: true
      legend: enabled: true
      yAxis:
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
    
    data = JSON.parse(data.data)
    
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
    
    data.map (x) ->
      x.visible = legendDefault[x.name]
      
    @createChart(data)